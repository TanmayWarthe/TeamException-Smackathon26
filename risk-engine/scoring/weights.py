"""
risk-engine/scoring/weights.py
Hardcoded weight configuration matching Chapter 8.4 of the CTIP spec.

Weights MUST sum to 1.0 — this is enforced with an assertion.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from shared.config import ANALYSIS_WEIGHTS

# Re-export from shared config (single source of truth)
WEIGHTS = ANALYSIS_WEIGHTS

# ── Validate ─────────────────────────────────────────────────
_total = sum(WEIGHTS.values())
assert abs(_total - 1.0) < 1e-6, (
    f"Analysis weights must sum to 1.0, got {_total}. "
    f"Weights: {WEIGHTS}"
)

# ── Per-component weights (for direct import convenience) ────
W_VISUAL     = WEIGHTS["visual"]      # 0.25
W_DOM        = WEIGHTS["dom"]         # 0.20
W_FORM       = WEIGHTS["form"]        # 0.20
W_LOGO       = WEIGHTS["logo"]        # 0.10
W_URL        = WEIGHTS["url"]         # 0.05
W_SSL        = WEIGHTS["ssl"]         # 0.05
W_JAVASCRIPT = WEIGHTS["javascript"]  # 0.15


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    print("Analysis Weights (Chapter 8.4):")
    for name, weight in sorted(WEIGHTS.items(), key=lambda x: -x[1]):
        print(f"  {name:12s} = {weight:.2f} ({weight*100:.0f}%)")
    print(f"\n  Total = {sum(WEIGHTS.values()):.2f}")
