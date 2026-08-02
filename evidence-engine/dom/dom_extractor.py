"""
evidence-engine/dom/dom_extractor.py
DOM fingerprint extraction for candidate websites.

Reuses the shared implementation from digital-twin/extractor/dom_extractor.py
to ensure apples-to-apples comparison between twins and candidates.
"""

import importlib.util
from pathlib import Path

# ── Import shared DOM extractor ──────────────────────────────
_dt_dom_path = (
    Path(__file__).resolve().parent.parent.parent
    / "digital-twin" / "extractor" / "dom_extractor.py"
)
_spec = importlib.util.spec_from_file_location("dt_dom_extractor", str(_dt_dom_path))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

# Re-export the shared function
extract_dom_fingerprint = _mod.extract_dom_fingerprint


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    sample = "<html><body><form><input type='text'/><input type='password'/></form></body></html>"
    fp = extract_dom_fingerprint(sample)
    import json
    print(json.dumps(fp, indent=2))
