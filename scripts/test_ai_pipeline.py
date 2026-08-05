#!/usr/bin/env python3
"""
scripts/test_ai_pipeline.py
End-to-end test of the CTIP AI/ML Analysis Pipeline.

This script:
    1. Generates a Digital Twin for a real public site (GitHub login)
    2. Runs analyze_website() against multiple URLs
    3. Prints the final JSON response for each

Usage:
    cd Campus-Threat-Intelligence/
    python scripts/test_ai_pipeline.py
"""

import json
import sys
import time
from pathlib import Path

# ── Setup Python path ────────────────────────────────────────
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import importlib.util


def load_mod(name, path):
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Load modules
fingerprint_mod = load_mod("fingerprint",
    project_root / "digital-twin" / "generator" / "fingerprint.py")
twin_store_mod = load_mod("twin_store",
    project_root / "digital-twin" / "storage" / "twin_store.py")
engine_mod = load_mod("engine",
    project_root / "risk-engine" / "engine.py")


def main():
    print("=" * 70)
    print("  CTIP AI/ML Pipeline — End-to-End Test")
    print("=" * 70)

    # ── Step 1: Generate Digital Twin ────────────────────────
    # Using GitHub login as a stand-in "official institutional portal"
    official_url = "https://github.com/login"
    twin_domain = "github.com"

    print(f"\n📸 Step 1: Generating Digital Twin for {official_url}")
    print("-" * 50)

    start = time.time()

    # Check if twin already exists
    existing_twin = twin_store_mod.load_twin(twin_domain)
    if existing_twin:
        print(f"  ✅ Twin already exists for {twin_domain}, reusing it.")
        twin = existing_twin
    else:
        twin = fingerprint_mod.generate_fingerprint_sync(
            url=official_url,
            website_name="GitHub Login (Test Twin)",
        )
        print(f"  ✅ Twin generated in {time.time() - start:.1f}s")

    # Print twin summary
    print(f"\n  Twin Summary:")
    print(f"    Website:    {twin.get('website_name', '?')}")
    print(f"    Domain:     {twin.get('domain', '?')}")
    print(f"    DOM:        {twin.get('dom_fingerprint', {}).get('element_count', '?')} elements")
    print(f"    Forms:      {twin.get('dom_fingerprint', {}).get('form_count', '?')}")
    print(f"    Screenshot: {twin.get('screenshot_path', '?')}")
    print(f"    Logo:       {twin.get('logo_path', 'Not detected')}")
    print(f"    Colors:     {twin.get('css_colors', [])[:3]}")

    # ── Step 2: Analyze test URLs ────────────────────────────
    test_cases = [
        {
            "url": "https://github.com/login",
            "expected": "TRUSTED/LOW — this IS the official site",
        },
        {
            "url": "https://www.google.com",
            "expected": "LOW — completely unrelated site",
        },
        {
            "url": "https://stackoverflow.com/users/login",
            "expected": "VARIES — another login page, different site",
        },
    ]

    print(f"\n\n🔍 Step 2: Running Analysis on {len(test_cases)} URLs")
    print("=" * 70)

    results = []

    for i, tc in enumerate(test_cases, 1):
        url = tc["url"]
        expected = tc["expected"]

        print(f"\n{'─' * 70}")
        print(f"  Test {i}/{len(test_cases)}: {url}")
        print(f"  Expected: {expected}")
        print(f"{'─' * 70}")

        start = time.time()

        try:
            result = engine_mod.analyze_website_sync(url, twin)
            elapsed = time.time() - start

            results.append({
                "url": url,
                "result": result,
                "elapsed_sec": round(elapsed, 1),
            })

            print(f"\n  ⏱  Completed in {elapsed:.1f}s")

        except Exception as e:
            print(f"\n  ❌ Error analyzing {url}: {e}")
            import traceback
            traceback.print_exc()
            results.append({
                "url": url,
                "result": {"error": str(e)},
                "elapsed_sec": 0,
            })

    # ── Summary ──────────────────────────────────────────────
    print("\n\n" + "=" * 70)
    print("  📊 RESULTS SUMMARY")
    print("=" * 70)

    for r in results:
        res = r["result"]
        status = res.get("status", "ERROR")
        score = res.get("risk_score", "?")
        confidence = res.get("confidence", "?")
        recommendation = res.get("recommendation", "?")
        reasons = res.get("reasons", [])

        # Color-code status
        status_icon = {
            "TRUSTED": "🟢", "LOW_RISK": "🟡", "SUSPICIOUS": "🟠",
            "HIGH_RISK": "🔴", "CRITICAL": "🔴💀",
        }.get(status, "❓")

        print(f"\n  {status_icon} {r['url']}")
        print(f"     Status:         {status}")
        print(f"     Risk Score:     {score}")
        print(f"     Confidence:     {confidence}")
        print(f"     Recommendation: {recommendation}")
        print(f"     Time:           {r['elapsed_sec']}s")
        if reasons:
            print(f"     Reasons:")
            for reason in reasons:
                print(f"       • {reason}")

    # ── Final JSON output ────────────────────────────────────
    print("\n\n" + "=" * 70)
    print("  📋 RAW JSON RESPONSES (for backend integration verification)")
    print("=" * 70)

    for r in results:
        print(f"\n  URL: {r['url']}")
        print(f"  {json.dumps(r['result'], indent=4)}")

    print("\n\n✅ Pipeline test complete!")
    print(f"   Total URLs analyzed: {len(results)}")
    print(f"   Import for backend: from risk_engine.engine import analyze_website")


if __name__ == "__main__":
    main()
