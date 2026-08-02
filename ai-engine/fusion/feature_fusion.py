"""
ai-engine/fusion/feature_fusion.py
Calls all individual analyzers and returns a flat dict of similarity scores.
This is the single object consumed by risk-engine.
"""

import importlib.util
from pathlib import Path
from typing import Any

# ── Dynamic imports from hyphenated directories ──────────────
_ai_base = Path(__file__).resolve().parent.parent


def _load(name: str, path: str):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_visual = _load("vis", str(_ai_base / "visual" / "visual_similarity.py"))
_dom = _load("dom", str(_ai_base / "dom" / "dom_similarity.py"))
_logo = _load("logo", str(_ai_base / "logo" / "logo_similarity.py"))
_forms = _load("forms", str(_ai_base / "forms" / "form_similarity.py"))
_css = _load("css", str(_ai_base / "css" / "css_similarity.py"))
_url = _load("url", str(_ai_base / "url" / "url_intelligence.py"))


def fuse(candidate_evidence: dict[str, Any], digital_twin: dict[str, Any]) -> dict[str, Any]:
    """
    Run all similarity analyzers and return a flat score dict.

    Args:
        candidate_evidence: Output of evidence-engine/pipeline.py extract_evidence()
        digital_twin: Loaded Digital Twin dict from twin_store.py

    Returns:
        dict with keys:
            - visual: float 0-100 (higher = more similar = more suspicious)
            - dom: float 0-100
            - logo: float 0-100
            - form: float 0-100
            - css: float 0-100
            - url: float 0-100 (INVERTED: low = suspicious, high = safe)
            - ssl: float 0-100 (placeholder)
            - javascript: float 0-100 (placeholder)
            - red_flags: list[str] (specific phishing indicators)
            - _metadata: dict with per-analyzer details
    """
    red_flags: list[str] = []

    # ── Visual similarity (CLIP screenshot embeddings) ───────
    visual_score = _visual.compute_visual_similarity(
        candidate_evidence.get("visual_embedding"),
        digital_twin.get("visual_embedding"),
    )

    # ── DOM structural similarity ────────────────────────────
    dom_score = _dom.compute_dom_similarity(
        candidate_evidence.get("dom_fingerprint", {}),
        digital_twin.get("dom_fingerprint", {}),
    )

    # ── Logo similarity (CLIP logo embeddings) ───────────────
    logo_score = _logo.compute_logo_similarity(
        candidate_evidence.get("logo_embedding"),
        digital_twin.get("logo_embedding"),
    )

    # ── Form similarity + red flags ──────────────────────────
    form_score, form_flags = _forms.compute_form_similarity(
        candidate_evidence.get("form_fingerprint", {}),
        digital_twin.get("dom_fingerprint", {}),
        candidate_evidence.get("domain", ""),
        digital_twin.get("domain", ""),
    )
    red_flags.extend(form_flags)

    # ── CSS color palette similarity ─────────────────────────
    css_score = _css.compute_css_similarity(
        candidate_evidence.get("css_colors", []),
        digital_twin.get("css_colors", []),
    )

    # ── URL intelligence (INVERTED SCALE) ────────────────────
    url_score, url_flags = _url.compute_url_intelligence(
        candidate_evidence.get("candidate_url", ""),
        digital_twin.get("domain", ""),
    )
    red_flags.extend(url_flags)

    # ── SSL analysis — placeholder for MVP ───────────────────
    # TODO: Implement SSL certificate analysis
    # For now, return a neutral score
    ssl_score = 50.0

    # ── JavaScript analysis — placeholder for MVP ────────────
    # TODO: Implement JavaScript behavioral analysis
    # Default to 70 as noted in spec (Chapter 8.4)
    javascript_score = 70.0

    result = {
        "visual": float(visual_score),
        "dom": float(dom_score),
        "logo": float(logo_score),
        "form": float(form_score),
        "css": float(css_score),
        "url": float(url_score),  # INVERTED SCALE — documented
        "ssl": float(ssl_score),
        "javascript": float(javascript_score),
        "red_flags": red_flags,
        "_metadata": {
            "visual_has_data": candidate_evidence.get("visual_embedding") is not None,
            "logo_has_data": candidate_evidence.get("logo_embedding") is not None,
            "form_has_data": candidate_evidence.get("form_fingerprint", {}).get("form_count", 0) > 0,
            "css_has_data": len(candidate_evidence.get("css_colors", [])) > 0,
        },
    }

    return result


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    import json
    import numpy as np

    # Mock data
    mock_twin = {
        "domain": "erp.ycce.edu.in",
        "visual_embedding": np.random.randn(512).astype(np.float32),
        "logo_embedding": np.random.randn(512).astype(np.float32),
        "dom_fingerprint": {
            "element_count": 340, "form_count": 1, "input_count": 3,
            "dom_depth": 12, "tag_frequency": {"div": 120, "span": 45},
            "has_nav": True, "has_header": True, "has_footer": True,
        },
        "css_colors": ["#1e3a8a", "#ffffff"],
    }

    mock_candidate = {
        "candidate_url": "https://erp-ycce.site/login",
        "domain": "erp-ycce.site",
        "visual_embedding": mock_twin["visual_embedding"] + np.random.randn(512).astype(np.float32) * 0.1,
        "logo_embedding": mock_twin["logo_embedding"] + np.random.randn(512).astype(np.float32) * 0.05,
        "dom_fingerprint": {
            "element_count": 335, "form_count": 1, "input_count": 3,
            "dom_depth": 12, "tag_frequency": {"div": 118, "span": 44},
            "has_nav": True, "has_header": True, "has_footer": True,
        },
        "form_fingerprint": {
            "form_count": 1,
            "forms": [{"field_type_sequence": ["text", "password"], "input_count": 2,
                       "has_password": True, "has_remember_me": False,
                       "action_is_external": True}],
            "has_password_field": True,
            "has_external_action": True,
            "external_action_domains": ["evil-server.xyz"],
        },
        "css_colors": ["#1e3b8c", "#fefefe"],
    }

    result = fuse(mock_candidate, mock_twin)
    print(json.dumps({k: v for k, v in result.items() if k != "_metadata"}, indent=2, default=str))
