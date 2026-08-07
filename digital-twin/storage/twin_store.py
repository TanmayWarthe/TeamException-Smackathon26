"""
digital-twin/storage/twin_store.py
Simple JSON-file-based key-value store for Digital Twins.

TODO: Replace with real PostgreSQL Digital Twins table
(schema defined in Chapter 14.5 of the project spec).
Field mapping:
    - website_name       -> twin dict "website_name"
    - official_url       -> twin dict "official_url"
    - fingerprint_version -> twin dict "fingerprint_version"
    - screenshot_path    -> twin dict "screenshot_path"
    - visual_embedding   -> stored as .npy file alongside JSON
    - dom_hash           -> hash of dom_fingerprint
    - css_hash           -> hash of css_colors
    - logo_hash          -> hash of logo_embedding
    - ssl_fingerprint    -> not implemented in MVP
"""

import json
import hashlib
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Any, Optional

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from shared.config import TWINS_DIR, EMBEDDINGS_DIR, SCREENSHOTS_DIR, LOGOS_DIR, sanitize_domain


def _twin_path(domain: str) -> Path:
    return TWINS_DIR / f"{sanitize_domain(domain)}.json"


def _embedding_path(domain: str, kind: str = "visual") -> Path:
    return EMBEDDINGS_DIR / f"{sanitize_domain(domain)}_{kind}.npy"


def save_twin(domain: str, twin_dict: dict[str, Any]) -> str:
    """
    Save a Digital Twin to local JSON file storage.
    Also saves numpy embeddings as separate .npy files.

    Returns:
        Path to the saved JSON file.
    """
    TWINS_DIR.mkdir(parents=True, exist_ok=True)
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)

    # Extract and save numpy embeddings separately
    twin_copy = dict(twin_dict)

    for embed_key in ["visual_embedding", "logo_embedding"]:
        emb = twin_copy.get(embed_key)
        if emb is not None:
            if isinstance(emb, np.ndarray):
                kind = embed_key.replace("_embedding", "")
                npy_path = _embedding_path(domain, kind)
                np.save(str(npy_path), emb)
                # Store as list in JSON for portability
                twin_copy[embed_key] = [float(x) for x in emb.flatten().tolist()]
            elif isinstance(emb, list):
                kind = embed_key.replace("_embedding", "")
                npy_path = _embedding_path(domain, kind)
                arr = np.array(emb, dtype=np.float32)
                np.save(str(npy_path), arr)
                twin_copy[embed_key] = [float(x) for x in arr.flatten().tolist()]


    # Save JSON
    json_path = _twin_path(domain)
    with open(json_path, "w") as f:
        json.dump(twin_copy, f, indent=2, default=str)

    return str(json_path)


def load_twin(domain: str) -> Optional[dict[str, Any]]:
    """
    Load a Digital Twin from local JSON storage.
    Also loads numpy embeddings from .npy files if they exist.

    Returns:
        Twin dict with numpy arrays for embeddings, or None if not found.
    """
    json_path = _twin_path(domain)
    if not json_path.exists():
        return None

    with open(json_path) as f:
        twin = json.load(f)

    # Load numpy embeddings
    for embed_key in ["visual_embedding", "logo_embedding"]:
        kind = embed_key.replace("_embedding", "")
        npy_path = _embedding_path(domain, kind)
        if npy_path.exists():
            twin[embed_key] = np.load(str(npy_path))
        elif embed_key in twin and isinstance(twin[embed_key], list):
            twin[embed_key] = np.array(twin[embed_key], dtype=np.float32)

    return twin


def load_all_twins() -> list[dict[str, Any]]:
    """Load all registered Digital Twins with full embeddings."""
    twins = []
    if not TWINS_DIR.exists():
        return twins
    for json_file in sorted(TWINS_DIR.glob("*.json")):
        domain_name = json_file.stem.replace("_", ".")
        t = load_twin(domain_name)
        if t:
            twins.append(t)
    return twins


def list_twins() -> list[dict[str, Any]]:
    """
    List all stored Digital Twins (metadata only, no embeddings loaded).

    Returns:
        List of twin summary dicts.
    """
    twins = []
    if not TWINS_DIR.exists():
        return twins

    for json_file in sorted(TWINS_DIR.glob("*.json")):
        try:
            with open(json_file) as f:
                twin = json.load(f)
            # Don't include full embeddings in listing
            summary = {
                "website_name": twin.get("website_name", ""),
                "official_url": twin.get("official_url", ""),
                "domain": twin.get("domain", json_file.stem.replace("_", ".")),
                "fingerprint_version": twin.get("fingerprint_version", 0),
                "created_at": twin.get("created_at", ""),
                "has_visual_embedding": bool(twin.get("visual_embedding")),
                "has_logo_embedding": bool(twin.get("logo_embedding")),
            }
            twins.append(summary)
        except Exception as e:
            print(f"[TwinStore] Error reading {json_file}: {e}")

    return twins


def delete_twin(domain: str) -> bool:
    """Delete a stored Digital Twin, its embeddings, and associated screenshot/logo files."""
    sanitized = sanitize_domain(domain)
    json_path = _twin_path(domain)
    deleted = False

    # Read twin metadata before deleting JSON to clean up any explicit paths
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                twin_data = json.load(f)
                custom_shot = twin_data.get("screenshot_path")
                if custom_shot:
                    custom_shot_p = Path(custom_shot)
                    if custom_shot_p.exists() and custom_shot_p.is_file():
                        custom_shot_p.unlink()
                custom_logo = twin_data.get("logo_path")
                if custom_logo:
                    custom_logo_p = Path(custom_logo)
                    if custom_logo_p.exists() and custom_logo_p.is_file():
                        custom_logo_p.unlink()
        except Exception:
            pass

        json_path.unlink()
        deleted = True

    for kind in ["visual", "logo"]:
        npy_path = _embedding_path(domain, kind)
        if npy_path.exists():
            npy_path.unlink()
            deleted = True

    # Also clean up standard named screenshot and logo files if present
    for ext in [".png", ".jpg", ".jpeg", ".webp"]:
        shot_path = SCREENSHOTS_DIR / f"{sanitized}{ext}"
        if shot_path.exists() and shot_path.is_file():
            shot_path.unlink()
            deleted = True
        logo_path = LOGOS_DIR / f"{sanitized}{ext}"
        if logo_path.exists() and logo_path.is_file():
            logo_path.unlink()
            deleted = True

    return deleted


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    print("TwinStore — Standalone Test")

    # Create a mock twin
    mock_twin = {
        "website_name": "Test Site",
        "official_url": "https://test.example.com",
        "domain": "test.example.com",
        "visual_embedding": np.random.randn(512).astype(np.float32),
        "logo_embedding": np.random.randn(512).astype(np.float32),
        "dom_fingerprint": {"element_count": 100},
        "created_at": datetime.utcnow().isoformat(),
        "fingerprint_version": 1,
    }

    path = save_twin("test.example.com", mock_twin)
    print(f"Saved to: {path}")

    loaded = load_twin("test.example.com")
    if loaded:
        print(f"Loaded: {loaded['website_name']}")
        print(f"Visual embedding shape: {loaded['visual_embedding'].shape}")

    twins = list_twins()
    print(f"Total twins stored: {len(twins)}")

    # Cleanup test
    delete_twin("test.example.com")
    print("Cleaned up test twin.")
