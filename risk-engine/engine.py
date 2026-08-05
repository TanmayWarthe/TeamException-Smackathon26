"""
risk-engine/engine.py
Top-level orchestrator for the CTIP AI/ML Analysis Pipeline.

This is the SINGLE FUNCTION the backend developer imports:

    from risk_engine.engine import analyze_website

It returns the EXACT response shape expected by the frontend and extension:
    {
        "status": "HIGH_RISK",
        "risk_score": 82,
        "confidence": 91,
        "recommendation": "BLOCK",
        "reasons": ["Copied Institutional Logo", "Similar DOM", ...]
    }
"""

import importlib.util
import json
from pathlib import Path
from typing import Any, Optional

# ── Dynamic module loading (handles hyphenated directory names) ──
_project_root = Path(__file__).resolve().parent.parent


def _load_mod(name: str, path: str):
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Evidence pipeline
_evidence = _load_mod("evidence_pipeline",
    _project_root / "evidence-engine" / "pipeline.py")

# AI engine fusion
_fusion = _load_mod("feature_fusion",
    _project_root / "ai-engine" / "fusion" / "feature_fusion.py")

# Risk scoring
_scoring = _load_mod("scoring_engine",
    _project_root / "risk-engine" / "scoring" / "engine.py")

# Thresholds
_categorize = _load_mod("categorize",
    _project_root / "risk-engine" / "thresholds" / "categorize.py")

# Explanation
_explain = _load_mod("explain",
    _project_root / "risk-engine" / "reports" / "explain.py")

# Twin store
_twin_store = _load_mod("twin_store",
    _project_root / "digital-twin" / "storage" / "twin_store.py")


import asyncio


async def analyze_website(
    candidate_url: str,
    digital_twin: dict[str, Any] | str,
) -> dict[str, Any]:
    """
    Full end-to-end analysis of a candidate website against a Digital Twin (async).

    Args:
        candidate_url: URL of the suspicious/candidate website.
        digital_twin: Either a loaded Digital Twin dict, or a domain string
                      to load from twin_store.

    Returns:
        dict matching the API contract EXACTLY:
        {
            "status": str,           # "TRUSTED" | "LOW_RISK" | "SUSPICIOUS" | "HIGH_RISK" | "CRITICAL"
            "risk_score": int,       # 0-100
            "confidence": int,       # 0-100
            "recommendation": str,   # "ALLOW" | "WARN" | "BLOCK"
            "reasons": list[str],    # 3-5 human-readable explanation strings
        }

    Raises:
        ValueError: If the digital_twin domain is not found in storage.
    """
    # ── Load twin if string domain was passed ────────────────
    if isinstance(digital_twin, str):
        twin = _twin_store.load_twin(digital_twin)
        if twin is None:
            raise ValueError(
                f"Digital Twin not found for domain '{digital_twin}'. "
                f"Generate one first with digital-twin/generator/fingerprint.py"
            )
    else:
        twin = digital_twin

    print(f"\n{'='*60}")
    print(f"[CTIP] Analyzing: {candidate_url}")
    print(f"[CTIP] Against twin: {twin.get('official_url', twin.get('domain', '?'))}")
    print(f"{'='*60}")

    # ── Step 1: Extract evidence from candidate ──────────────
    print("\n[Step 1/4] Extracting evidence from candidate site...")
    evidence = await _evidence.extract_evidence(candidate_url)

    # ── Step 2: Run all similarity analyzers (fusion) ────────
    print("\n[Step 2/4] Running similarity analysis...")
    fused_scores = _fusion.fuse(evidence, twin)

    print(f"  Visual:     {fused_scores['visual']:.1f}")
    print(f"  DOM:        {fused_scores['dom']:.1f}")
    print(f"  Logo:       {fused_scores['logo']:.1f}")
    print(f"  Form:       {fused_scores['form']:.1f}")
    print(f"  CSS:        {fused_scores['css']:.1f}")
    print(f"  URL:        {fused_scores['url']:.1f} (inverted: low=suspicious)")
    print(f"  SSL:        {fused_scores['ssl']:.1f} (placeholder)")
    print(f"  JavaScript: {fused_scores['javascript']:.1f} (placeholder)")

    if fused_scores["red_flags"]:
        print(f"  Red flags:  {fused_scores['red_flags']}")

    # ── Step 3: Calculate risk score ─────────────────────────
    print("\n[Step 3/4] Calculating risk score...")
    risk_result = _scoring.calculate_risk(fused_scores)
    category = _categorize.categorize_risk(risk_result["risk_score"])

    print(f"  Risk Score:     {risk_result['risk_score']:.1f}")
    print(f"  Confidence:     {risk_result['confidence']:.1f}")
    print(f"  Status:         {category['status']}")
    print(f"  Recommendation: {category['recommendation']}")

    # ── Step 4: Generate explanation reasons ─────────────────
    print("\n[Step 4/4] Generating explanations...")
    reasons = _explain.generate_reasons(
        fused_scores=fused_scores,
        contributions=risk_result["component_contributions"],
        red_flags=fused_scores.get("red_flags", []),
    )

    # ── Assemble final response ──────────────────────────────
    # Cast to plain Python types to prevent numpy serialization issues
    response = {
        "status": category["status"],
        "risk_score": int(round(risk_result["risk_score"])),
        "confidence": int(round(risk_result["confidence"])),
        "recommendation": category["recommendation"],
        "reasons": reasons,
    }

    print(f"\n{'='*60}")
    print(f"[CTIP] RESULT: {json.dumps(response, indent=2)}")
    print(f"{'='*60}\n")

    return response


def analyze_website_sync(
    candidate_url: str,
    digital_twin: dict[str, Any] | str,
) -> dict[str, Any]:
    """Synchronous wrapper for analyze_website()."""
    try:
        asyncio.get_running_loop()
        raise RuntimeError(
            "analyze_website_sync() cannot be called from a running event loop. "
            "Use 'await analyze_website(candidate_url, digital_twin)' instead."
        )
    except RuntimeError as e:
        if "cannot be called from a running event loop" in str(e):
            raise
        return asyncio.run(analyze_website(candidate_url, digital_twin))


async def analyze_website_with_details(
    candidate_url: str,
    digital_twin: dict[str, Any] | str,
) -> dict[str, Any]:
    """
    Extended version of analyze_website that also returns per-analyzer
    breakdowns for debugging and the SOC dashboard (async).
    """
    if isinstance(digital_twin, str):
        twin = _twin_store.load_twin(digital_twin)
        if twin is None:
            raise ValueError(f"Digital Twin not found: '{digital_twin}'")
    else:
        twin = digital_twin

    evidence = await _evidence.extract_evidence(candidate_url)
    fused_scores = _fusion.fuse(evidence, twin)
    risk_result = _scoring.calculate_risk(fused_scores)
    category = _categorize.categorize_risk(risk_result["risk_score"])
    reasons = _explain.generate_reasons(
        fused_scores, risk_result["component_contributions"],
        fused_scores.get("red_flags", []),
    )

    return {
        # Standard API response
        "status": category["status"],
        "risk_score": int(round(risk_result["risk_score"])),
        "confidence": int(round(risk_result["confidence"])),
        "recommendation": category["recommendation"],
        "reasons": reasons,
        # Extended details for dashboard / debugging
        "details": {
            "fused_scores": {k: float(v) for k, v in fused_scores.items()
                             if isinstance(v, (int, float))},
            "component_contributions": {
                k: {kk: float(vv) for kk, vv in v.items()}
                for k, v in risk_result["component_contributions"].items()
            },
            "red_flags": fused_scores.get("red_flags", []),
            "candidate_domain": evidence.get("domain", ""),
            "twin_domain": twin.get("domain", ""),
        },
    }


def analyze_website_with_details_sync(
    candidate_url: str,
    digital_twin: dict[str, Any] | str,
) -> dict[str, Any]:
    """Synchronous wrapper for analyze_website_with_details()."""
    try:
        asyncio.get_running_loop()
        raise RuntimeError(
            "analyze_website_with_details_sync() cannot be called from a running event loop. "
            "Use 'await analyze_website_with_details(candidate_url, digital_twin)' instead."
        )
    except RuntimeError as e:
        if "cannot be called from a running event loop" in str(e):
            raise
        return asyncio.run(analyze_website_with_details(candidate_url, digital_twin))


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    print("Risk Engine — requires a generated Digital Twin to test.")
    print("Run scripts/test_ai_pipeline.py for a full end-to-end test.")

