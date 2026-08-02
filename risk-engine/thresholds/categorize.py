"""
risk-engine/thresholds/categorize.py
Maps a numeric risk score to a status label and recommendation.
Uses the exact thresholds from the API contract.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from shared.config import RISK_THRESHOLDS


def categorize_risk(risk_score: float) -> dict[str, str]:
    """
    Map a risk score (0-100) to a status string and recommendation.

    Risk Categories (matching frontend/extension contracts):
        0-25:   TRUSTED    / ALLOW
        26-50:  LOW_RISK   / ALLOW
        51-70:  SUSPICIOUS / WARN
        71-90:  HIGH_RISK  / WARN
        91-100: CRITICAL   / BLOCK

    Args:
        risk_score: Float 0-100.

    Returns:
        dict with 'status' and 'recommendation' keys.
    """
    score = max(0.0, min(100.0, risk_score))

    for threshold, status, recommendation in RISK_THRESHOLDS:
        if score <= threshold:
            return {
                "status": status,
                "recommendation": recommendation,
            }

    # Should never reach here, but safety fallback
    return {"status": "CRITICAL", "recommendation": "BLOCK"}


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    test_scores = [0, 10, 25, 26, 50, 51, 70, 71, 90, 91, 100]
    for s in test_scores:
        cat = categorize_risk(s)
        print(f"  Score {s:3d} → {cat['status']:12s} / {cat['recommendation']}")
