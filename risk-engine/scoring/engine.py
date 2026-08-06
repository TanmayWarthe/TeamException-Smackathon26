"""
risk-engine/scoring/engine.py
Calculates the final risk score from fused analyzer scores.

IMPORTANT: The URL score uses an INVERTED scale (low = suspicious).
This module correctly inverts it before applying the weight so the math
direction is consistent: high weighted sum = high risk.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from typing import Any


def calculate_risk(fused_scores: dict[str, Any]) -> dict[str, Any]:
    """
    Calculate weighted risk score from fused similarity scores and red-flag indicators.

    Args:
        fused_scores: Output of ai-engine/fusion/feature_fusion.py

    Returns:
        dict with:
            - risk_score: float 0-100
            - confidence: float 0-100
            - component_contributions: dict showing each analyzer's contribution
    """
    # ── Import weights dynamically to avoid hyphen-path issues ──
    import importlib.util
    weights_path = Path(__file__).resolve().parent / "weights.py"
    spec = importlib.util.spec_from_file_location("weights_mod", str(weights_path))
    weights_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(weights_mod)
    BASE_WEIGHTS = weights_mod.WEIGHTS

    metadata = fused_scores.get("_metadata", {})
    candidate_domain = (metadata.get("candidate_domain") or "").lower().strip()
    twin_domain = (metadata.get("twin_domain") or "").lower().strip()
    red_flags = fused_scores.get("red_flags", [])

    # Check for exact or subdomain official match
    is_official_domain = False
    if candidate_domain and twin_domain:
        if (candidate_domain == twin_domain or 
            candidate_domain == f"www.{twin_domain}" or 
            candidate_domain.endswith(f".{twin_domain}")):
            is_official_domain = True

    # ── 1. Determine active analyzers & renormalize weights ───
    active_weights = {}
    
    if metadata.get("visual_has_data", False):
        active_weights["visual"] = BASE_WEIGHTS.get("visual", 0.25)
    
    active_weights["dom"] = BASE_WEIGHTS.get("dom", 0.20)
    active_weights["form"] = BASE_WEIGHTS.get("form", 0.20)
    
    # URL intelligence carries increased weight when visual is absent
    url_base_weight = BASE_WEIGHTS.get("url", 0.05)
    active_weights["url"] = max(0.15, url_base_weight) if not metadata.get("visual_has_data", False) else url_base_weight

    if metadata.get("logo_has_data", False):
        active_weights["logo"] = BASE_WEIGHTS.get("logo", 0.10)
    if metadata.get("css_has_data", False):
        active_weights["css"] = BASE_WEIGHTS.get("css", 0.10)

    total_weight = sum(active_weights.values())
    norm_weights = {k: v / total_weight for k, v in active_weights.items()} if total_weight > 0 else {}

    # ── 2. Prepare component scores (invert URL score) ────────
    scores = {
        "visual":     fused_scores.get("visual", 50.0),
        "dom":        fused_scores.get("dom", 50.0),
        "form":       fused_scores.get("form", 50.0),
        "logo":       fused_scores.get("logo", 40.0),
        "css":        fused_scores.get("css", 50.0),
        # INVERT url score: low url_score (suspicious) → high risk contribution
        "url":        100.0 - fused_scores.get("url", 50.0),
    }

    # ── 3. Calculate weighted sum & contributions ─────────────
    risk_score = 0.0
    contributions = {}

    if is_official_domain and not red_flags:
        # Candidate IS the official site with no malicious flags
        for comp, weight in norm_weights.items():
            contributions[comp] = {
                "raw_score": 0.0,
                "weight": float(weight),
                "contribution": 0.0,
            }
        risk_score = 0.0
    else:
        for comp, weight in norm_weights.items():
            val = scores.get(comp, 50.0)
            contrib = val * weight
            risk_score += contrib
            contributions[comp] = {
                "raw_score": float(val),
                "weight": float(weight),
                "contribution": float(contrib),
            }

    # ── 4. Apply hard risk floors for high-severity phishing red flags ──
    # "Credential Submission" red flags now only appear when a form has
    # password fields AND submits to an unknown server (not for marketing
    # forms like HubSpot). So this floor is safe to apply when present.
    has_credential_theft = any(
        "Credential Submission" in rf and "Unknown Server" in rf
        for rf in red_flags
    )

    if has_credential_theft:
        # Credential theft is an active phishing attack
        if len(red_flags) >= 2 or not is_official_domain:
            risk_score = max(risk_score, 94.0)  # CRITICAL / BLOCK
        else:
            risk_score = max(risk_score, 88.0)  # HIGH_RISK / WARN
    elif len(red_flags) >= 3:
        risk_score = max(risk_score, 90.0)
    elif len(red_flags) >= 2:
        risk_score = max(risk_score, 78.0)
    elif len(red_flags) == 1:
        risk_score = max(risk_score, 65.0)

    # If verified official domain with no red flags, guarantee safe score
    if is_official_domain and not red_flags:
        risk_score = min(risk_score, 10.0)

    risk_score = float(max(0.0, min(100.0, risk_score)))

    # ── 5. Confidence calculation ─────────────────────────────
    confidence = 100.0
    if not metadata.get("visual_has_data", True):
        confidence -= 15
    if not metadata.get("logo_has_data", True):
        confidence -= 10
    if not metadata.get("form_has_data", True):
        confidence -= 10
    if not metadata.get("css_has_data", True):
        confidence -= 5

    # SSL & JS placeholders
    confidence -= 5
    confidence -= 5

    confidence = float(max(20.0, min(100.0, confidence)))

    return {
        "risk_score": risk_score,
        "confidence": confidence,
        "component_contributions": contributions,
    }


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    import json

    # High-risk phishing scenario
    high_risk = {
        "visual": 92, "dom": 88, "logo": 95, "form": 85,
        "css": 80, "url": 15, "ssl": 50, "javascript": 70,
        "_metadata": {"visual_has_data": True, "logo_has_data": True,
                      "form_has_data": True, "css_has_data": True},
    }

    # Low-risk legitimate scenario
    low_risk = {
        "visual": 30, "dom": 25, "logo": 40, "form": 20,
        "css": 35, "url": 90, "ssl": 50, "javascript": 70,
        "_metadata": {"visual_has_data": True, "logo_has_data": False,
                      "form_has_data": True, "css_has_data": True},
    }

    for name, scores in [("HIGH RISK", high_risk), ("LOW RISK", low_risk)]:
        result = calculate_risk(scores)
        print(f"\n{name}:")
        print(f"  Risk Score: {result['risk_score']:.1f}")
        print(f"  Confidence: {result['confidence']:.1f}")
        print(f"  Contributions:")
        for comp, data in sorted(result["component_contributions"].items(),
                                   key=lambda x: -x[1]["contribution"]):
            print(f"    {comp:12s}: {data['raw_score']:.0f} × {data['weight']:.2f} = {data['contribution']:.1f}")
