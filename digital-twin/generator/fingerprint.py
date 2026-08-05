"""
digital-twin/generator/fingerprint.py
Orchestrates complete Digital Twin fingerprint generation.

Calls render.py → dom_extractor → logo_extractor → clip_embedder,
assembles a single DigitalTwin dict, and persists it via twin_store.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from shared.config import SCREENSHOTS_DIR, LOGOS_DIR, sanitize_domain


# We need to handle the import differently due to hyphens in directory names.
# The actual imports are done via sys.path manipulation above, but we'll
# use a clean approach with importlib for production.

def _import_modules():
    """Import modules from hyphenated directories."""
    import importlib.util

    base = Path(__file__).resolve().parent.parent

    modules = {}
    specs = {
        "render": base / "generator" / "render.py",
        "dom_extractor": base / "extractor" / "dom_extractor.py",
        "logo_extractor": base / "extractor" / "logo_extractor.py",
        "clip_embedder": base / "embeddings" / "clip_embedder.py",
        "twin_store": base / "storage" / "twin_store.py",
    }

    for name, path in specs.items():
        spec = importlib.util.spec_from_file_location(name, str(path))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        modules[name] = mod

    return modules


import asyncio

_mods = _import_modules()
render_page = _mods["render"].render_page
render_page_sync = _mods["render"].render_page_sync
extract_dom_fingerprint = _mods["dom_extractor"].extract_dom_fingerprint
extract_logo = _mods["logo_extractor"].extract_logo
get_image_embedding = _mods["clip_embedder"].get_image_embedding
embedding_to_list = _mods["clip_embedder"].embedding_to_list
save_twin = _mods["twin_store"].save_twin


async def generate_fingerprint(
    url: str,
    website_name: str = "",
    fingerprint_version: int = 1,
) -> dict:
    """
    Generate a complete Digital Twin fingerprint for an official website (async).

    Args:
        url: The official URL to fingerprint (e.g. 'https://erp.ycce.edu.in')
        website_name: Human-readable name (e.g. 'YCCE ERP')
        fingerprint_version: Version number for the fingerprint schema

    Returns:
        Complete Digital Twin dict ready for storage and comparison.
    """
    print(f"[Fingerprint] Generating twin for: {url}")

    # Step 1: Render the page
    render_result = await render_page(url)
    domain = render_result["domain"]
    if not website_name:
        website_name = render_result.get("title", domain)

    print(f"[Fingerprint] Page rendered. Title: {render_result['title']}")

    # Step 2: Extract DOM fingerprint
    dom_fingerprint = extract_dom_fingerprint(render_result["html"])
    print(f"[Fingerprint] DOM fingerprint: {dom_fingerprint['element_count']} elements, "
          f"{dom_fingerprint['form_count']} forms")

    # Step 3: Extract and crop logo
    logo_path = extract_logo(
        screenshot_path=render_result["screenshot_path"],
        img_elements=render_result["img_elements"],
        domain=domain,
    )
    print(f"[Fingerprint] Logo: {'detected' if logo_path else 'not found'}")

    # Step 4: Generate CLIP embeddings
    visual_embedding = get_image_embedding(render_result["screenshot_path"])
    logo_embedding = get_image_embedding(logo_path) if logo_path else None

    if visual_embedding is not None:
        print(f"[Fingerprint] Visual embedding: shape={visual_embedding.shape}")
    if logo_embedding is not None:
        print(f"[Fingerprint] Logo embedding: shape={logo_embedding.shape}")

    # Step 5: Extract CSS colors (basic — from screenshot dominant colors)
    css_colors = _extract_dominant_colors(render_result["screenshot_path"])

    # Step 6: Assemble the Digital Twin dict
    twin = {
        "website_name": website_name,
        "official_url": url,
        "domain": domain,
        "screenshot_path": render_result["screenshot_path"],
        "logo_path": logo_path,
        "visual_embedding": visual_embedding,
        "logo_embedding": logo_embedding,
        "dom_fingerprint": dom_fingerprint,
        "css_colors": css_colors,
        "title": render_result.get("title", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "fingerprint_version": fingerprint_version,
    }

    # Step 7: Persist
    save_path = save_twin(domain, twin)
    print(f"[Fingerprint] Twin saved to: {save_path}")

    return twin


def generate_fingerprint_sync(
    url: str,
    website_name: str = "",
    fingerprint_version: int = 1,
) -> dict:
    """Synchronous wrapper for generate_fingerprint()."""
    try:
        asyncio.get_running_loop()
        raise RuntimeError(
            "generate_fingerprint_sync() cannot be called from a running event loop. "
            "Use 'await generate_fingerprint(url, website_name, fingerprint_version)' instead."
        )
    except RuntimeError as e:
        if "cannot be called from a running event loop" in str(e):
            raise
        return asyncio.run(generate_fingerprint(url, website_name, fingerprint_version))


def _extract_dominant_colors(screenshot_path: str, k: int = 5) -> list[str]:
    """
    Extract dominant colors from a screenshot using k-means clustering.
    Returns hex color strings.
    """
    try:
        try:
            from PIL import Image
            with Image.open(screenshot_path) as img:
                img = img.convert("RGB").resize((150, 100))
                quantized = img.quantize(colors=k)
                palette = quantized.getpalette()[:k*3]
                colors = []
                for i in range(k):
                    r, g, b = palette[i*3 : (i+1)*3]
                    colors.append(f"#{r:02x}{g:02x}{b:02x}")
                return colors
        except Exception:
            pass

        import cv2
        import numpy as np

        img = cv2.imread(screenshot_path)
        if img is None:
            return []

        # Resize for speed
        img = cv2.resize(img, (200, 150))
        pixels = img.reshape(-1, 3).astype(np.float32)

        # k-means
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
        _, labels, centers = cv2.kmeans(
            pixels, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS
        )

        # Sort by frequency
        label_counts = np.bincount(labels.flatten())
        sorted_indices = np.argsort(-label_counts)

        colors = []
        for idx in sorted_indices:
            b, g, r = centers[idx].astype(int)
            hex_color = f"#{r:02x}{g:02x}{b:02x}"
            colors.append(hex_color)

        return colors

    except Exception as e:
        return ["#1e3a8a", "#ffffff", "#0f172a"]


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    import json

    twin = generate_fingerprint_sync(
        url="https://github.com/login",
        website_name="GitHub Login",
    )

    # Print summary (exclude embeddings for readability)
    summary = {k: v for k, v in twin.items()
                if k not in ("visual_embedding", "logo_embedding")}
    print("\n" + "=" * 60)
    print("Digital Twin Generated:")
    print(json.dumps(summary, indent=2, default=str))

