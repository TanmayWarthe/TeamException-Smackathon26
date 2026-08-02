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
    Calculate weighted risk score from fused similarity scores.

    CRITICAL MATH NOTE:
        Most analyzers return 0-100 where high = similar = suspicious.
        EXCEPT url_intelligence which returns 0-100 where high = safe.

        The url score is INVERTED here (100 - url_score) before weighting,
        so the final formula is consistent: high weighted sum = high risk.

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
    WEIGHTS = weights_mod.WEIGHTS

    # ── Prepare scores (invert URL) ──────────────────────────
    scores = {
        "visual":     fused_scores.get("visual", 50.0),
        "dom":        fused_scores.get("dom", 50.0),
        "form":       fused_scores.get("form", 50.0),
        "logo":       fused_scores.get("logo", 40.0),
        "css":        fused_scores.get("css", 50.0),
        # INVERT url score: low url_score (suspicious) → high risk contribution
        "url":        100.0 - fused_scores.get("url", 50.0),
        "ssl":        fused_scores.get("ssl", 50.0),
        "javascript": fused_scores.get("javascript", 70.0),
    }

    # ── Weighted sum ─────────────────────────────────────────
    risk_score = 0.0
    contributions = {}

    for component, weight in WEIGHTS.items():
        value = scores.get(component, 50.0)
        contribution = value * weight
        risk_score += contribution
        contributions[component] = {
            "raw_score": float(value),
            "weight": float(weight),
            "contribution": float(contribution),
        }

    risk_score = float(max(0.0, min(100.0, risk_score)))

    # ── Confidence calculation ───────────────────────────────
    # Simple completeness heuristic for MVP:
    # 100 minus penalty for each analyzer with missing/fallback data
    metadata = fused_scores.get("_metadata", {})
    confidence = 100.0

    if not metadata.get("visual_has_data", True):
        confidence -= 15  # No screenshot embedding
    if not metadata.get("logo_has_data", True):
        confidence -= 10  # No logo detected
    if not metadata.get("form_has_data", True):
        confidence -= 10  # No forms found
    if not metadata.get("css_has_data", True):
        confidence -= 5   # No color data

    # SSL and JS are placeholders — penalize confidence
    confidence -= 5  # SSL not implemented
    confidence -= 5  # JS analysis not implemented

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
