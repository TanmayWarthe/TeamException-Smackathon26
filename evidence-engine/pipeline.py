"""
evidence-engine/pipeline.py
Single entry function: extract_evidence(url) -> dict

Processes a RAW CANDIDATE website (suspicious site) into the same structured
format as a Digital Twin, so the two can be compared apples-to-apples by
the ai-engine.
"""

import importlib.util
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from typing import Any

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.config import SCREENSHOTS_DIR, LOGOS_DIR, sanitize_domain


# ── Dynamic imports from hyphenated directory names ──────────
def _import_module(name: str, path: str):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

_base = Path(__file__).resolve().parent
_project = _base.parent

_render = _import_module("render", str(_project / "digital-twin" / "generator" / "render.py"))
_dom_ext = _import_module("dom_ext", str(_project / "digital-twin" / "extractor" / "dom_extractor.py"))
_logo_ext = _import_module("logo_ext", str(_project / "digital-twin" / "extractor" / "logo_extractor.py"))
_clip = _import_module("clip", str(_project / "digital-twin" / "embeddings" / "clip_embedder.py"))
_normalizer = _import_module("normalizer", str(_base / "html" / "normalizer.py"))
_form_ext = _import_module("form_ext", str(_base / "forms" / "form_extractor.py"))
_ss_proc = _import_module("ss_proc", str(_base / "screenshots" / "processor.py"))


import asyncio


async def extract_evidence(url: str) -> dict[str, Any]:
    """
    Process a candidate website into structured evidence for comparison (async).

    This produces the SAME shape as a Digital Twin's data so ai-engine
    can diff them directly.

    Args:
        url: Full URL of the candidate/suspicious site.

    Returns:
        dict with:
            - candidate_url, domain, title
            - screenshot_path, logo_path
            - visual_embedding, logo_embedding (numpy arrays)
            - dom_fingerprint (dict)
            - form_fingerprint (dict)
            - css_colors (list of hex strings)
            - detected_at (ISO timestamp)
            - render_failed (bool)
            - render_error (str | None)
    """
    url = (url or "").strip()
    if url and not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    domain = urlparse(url).hostname or url.replace("https://", "").replace("http://", "").split("/")[0] or "unknown"
    safe_name = sanitize_domain(domain)

    print(f"[Evidence] Processing candidate: {url}")

    # Step 1: Render the page (reuse digital-twin's renderer)
    screenshot_path = str(SCREENSHOTS_DIR / f"candidate_{safe_name}.png")
    try:
        render_result = await _render.render_page(url, screenshot_path=screenshot_path)
    except Exception as e:
        print(f"[Evidence] Render failed for {url}: {e}")
        return _empty_evidence(url, domain, error=str(e))

    print(f"[Evidence] Rendered. Title: {render_result.get('title', '')}")

    # Step 2: Normalize HTML
    clean_html = _normalizer.normalize_html(render_result["html"])

    # Step 3: DOM fingerprint (shared implementation)
    dom_fingerprint = _dom_ext.extract_dom_fingerprint(render_result["html"])

    # Step 4: Form fingerprint
    form_fingerprint = _form_ext.extract_forms(render_result["html"], url)

    # Step 5: Process screenshot (resize to standard)
    processed_ss = str(SCREENSHOTS_DIR / f"candidate_{safe_name}_processed.png")
    try:
        _ss_proc.process_screenshot(screenshot_path, output_path=processed_ss)
    except Exception as e:
        print(f"[Evidence] Screenshot processing failed: {e}")
        processed_ss = screenshot_path

    # Step 6: Extract logo
    logo_path = _logo_ext.extract_logo(
        screenshot_path=screenshot_path,
        img_elements=render_result.get("img_elements", []),
        domain=domain,
        logo_save_path=str(LOGOS_DIR / f"candidate_{safe_name}_logo.png"),
    )

    # Step 7: CLIP embeddings
    visual_embedding = _clip.get_image_embedding(processed_ss)
    logo_embedding = _clip.get_image_embedding(logo_path) if logo_path else None

    # Step 8: Extract CSS colors from screenshot
    css_colors = _ss_proc.extract_dominant_colors(processed_ss)

    evidence = {
        "candidate_url": url,
        "domain": domain,
        "title": render_result.get("title", ""),
        "screenshot_path": processed_ss,
        "logo_path": logo_path,
        "visual_embedding": visual_embedding,
        "logo_embedding": logo_embedding,
        "dom_fingerprint": dom_fingerprint,
        "form_fingerprint": form_fingerprint,
        "css_colors": css_colors,
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "render_failed": False,
        "render_error": None,
    }

    print(f"[Evidence] Extraction complete for {domain}")
    return evidence


def extract_evidence_sync(url: str) -> dict[str, Any]:
    """Synchronous wrapper for extract_evidence()."""
    try:
        asyncio.get_running_loop()
        raise RuntimeError(
            "extract_evidence_sync() cannot be called from a running event loop. "
            "Use 'await extract_evidence(url)' instead."
        )
    except RuntimeError as e:
        if "cannot be called from a running event loop" in str(e):
            raise
        return asyncio.run(extract_evidence(url))


def _empty_evidence(url: str, domain: str, error: str | None = None) -> dict[str, Any]:
    """Return a fallback evidence dict when rendering fails."""
    return {
        "candidate_url": url,
        "domain": domain,
        "title": "",
        "screenshot_path": None,
        "logo_path": None,
        "visual_embedding": None,
        "logo_embedding": None,
        "dom_fingerprint": {
            "element_count": 0, "tag_frequency": {}, "dom_depth": 0,
            "form_count": 0, "input_count": 0, "has_nav": False,
            "has_header": False, "has_footer": False, "link_count": 0,
            "script_count": 0, "meta_tags": [],
        },
        "form_fingerprint": {
            "form_count": 0, "forms": [], "has_password_field": False,
            "has_external_action": False, "external_action_domains": [],
        },
        "css_colors": [],
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "render_failed": True,
        "render_error": error,
    }


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    import json
    import numpy as np

    evidence = extract_evidence_sync("https://github.com/login")

    # Print summary (mask embeddings)
    summary = {}
    for k, v in evidence.items():
        if isinstance(v, np.ndarray):
            summary[k] = f"<np.ndarray shape={v.shape}>"
        else:
            summary[k] = v

    print("\n" + "=" * 60)
    print("Evidence Extracted:")
    print(json.dumps(summary, indent=2, default=str))

