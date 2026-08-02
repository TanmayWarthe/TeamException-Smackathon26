"""
ai-engine/engine.py
Convenience re-export of the feature fusion entry point.

For direct usage:
    from ai_engine.engine import fuse
    scores = fuse(candidate_evidence, digital_twin)
"""

import importlib.util
from pathlib import Path

_base = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    "fusion", str(_base / "fusion" / "feature_fusion.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

# Re-export
fuse = _mod.fuse
