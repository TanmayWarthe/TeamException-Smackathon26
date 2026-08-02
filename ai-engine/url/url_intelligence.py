"""
ai-engine/url/url_intelligence.py
Rule-based URL risk analysis — no ML needed.

IMPORTANT: This analyzer uses an INVERTED scale compared to other analyzers:
    - LOW score (0-30)   = the URL looks suspicious / risky
    - HIGH score (70-100) = the URL looks legitimate / safe

The risk-engine MUST invert this before weighting. See risk-engine/scoring/engine.py.
This is explicitly documented here to prevent the most common integration bug.
"""

import re
from urllib.parse import urlparse
from typing import Any

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from shared.config import SUSPICIOUS_TLDS


def compute_url_intelligence(
    candidate_url: str,
    twin_domain: str,
) -> tuple[float, list[str]]:
    """
    Rule-based URL risk analysis.

    INVERTED SCALE:
        LOW score  → URL is suspicious (contributes to HIGH risk)
        HIGH score → URL is safe (contributes to LOW risk)

    Checks:
        1. Levenshtein distance to official domain (typosquatting)
        2. Suspicious TLDs (.xyz, .top, .site, etc.)
        3. Hyphen abuse / excessive subdomains
        4. Homograph attack patterns (mixed scripts)

    Args:
        candidate_url: Full URL of the candidate site.
        twin_domain: Domain of the official twin site.

    Returns:
        Tuple of (score: float 0-100, red_flags: list[str]).
        REMEMBER: low score = suspicious.
    """
    red_flags: list[str] = []
    penalties = 0.0  # Accumulated penalty points (subtracted from 100)

    parsed = urlparse(candidate_url)
    candidate_domain = (parsed.hostname or "").lower()
    twin_domain = twin_domain.lower()

    if not candidate_domain:
        return 20.0, ["Could not parse candidate URL"]

    # ── 1. Exact domain match → it IS the official site ──────
    if candidate_domain == twin_domain or candidate_domain == f"www.{twin_domain}":
        return 95.0, []

    # ── 2. Levenshtein distance (typosquatting) ──────────────
    # Strip "www." for comparison
    clean_cand = candidate_domain.removeprefix("www.")
    clean_twin = twin_domain.removeprefix("www.")

    lev_dist = _levenshtein(clean_cand, clean_twin)
    # Very close but not exact = likely typosquatting
    if 1 <= lev_dist <= 3:
        penalties += 40
        red_flags.append(f"Domain resembles official site (edit distance: {lev_dist})")
    elif lev_dist <= 6 and len(clean_twin) > 6:
        penalties += 20
        red_flags.append("Suspicious Domain Registration")

    # ── 3. Suspicious TLD ────────────────────────────────────
    tld = "." + candidate_domain.split(".")[-1] if "." in candidate_domain else ""
    if tld in SUSPICIOUS_TLDS:
        penalties += 25
        red_flags.append(f"Suspicious top-level domain ({tld})")

    # ── 4. Hyphen abuse ──────────────────────────────────────
    # Legitimate domains rarely have more than 1 hyphen
    hyphen_count = candidate_domain.count("-")
    if hyphen_count >= 3:
        penalties += 20
        red_flags.append("Excessive hyphens in domain (possible spoofing)")
    elif hyphen_count >= 2:
        penalties += 10

    # ── 5. Excessive subdomains ──────────────────────────────
    subdomain_count = candidate_domain.count(".") - 1  # subtract the TLD dot
    if subdomain_count >= 3:
        penalties += 15
        red_flags.append("Excessive subdomain depth")

    # ── 6. Official domain name embedded as subdomain ────────
    # e.g., "ycce-login.evil.com" contains "ycce"
    twin_base = clean_twin.split(".")[0]  # e.g., "erp" from "erp.ycce.edu.in"
    twin_parts = clean_twin.replace(".", " ").split()
    for part in twin_parts:
        if len(part) >= 3 and part in clean_cand and clean_cand != clean_twin:
            penalties += 15
            red_flags.append(f"Official brand name '{part}' embedded in suspicious domain")
            break

    # ── 7. Homograph detection (basic) ───────────────────────
    # Check for non-ASCII characters that look like Latin letters
    if any(ord(c) > 127 for c in candidate_domain):
        penalties += 30
        red_flags.append("Internationalized domain name (possible homograph attack)")

    # TODO: Check domain registration age via WHOIS API
    # (Skipped for MVP — no external API access required)

    # ── Calculate final score ────────────────────────────────
    # Start at 100 (safe) and subtract penalties
    score = max(0.0, min(100.0, 100.0 - penalties))

    return float(score), red_flags


def _levenshtein(s1: str, s2: str) -> int:
    """Standard Levenshtein edit distance."""
    if len(s1) < len(s2):
        return _levenshtein(s2, s1)

    if len(s2) == 0:
        return len(s1)

    prev_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row

    return prev_row[-1]


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    official = "erp.ycce.edu.in"

    tests = [
        ("https://erp.ycce.edu.in/login", "Exact match"),
        ("https://erp.ycce.edu.xyz/login", "Suspicious TLD"),
        ("https://erp-ycce-edu.site/login", "Typosquat + bad TLD"),
        ("https://ycce-login.evil.com/login", "Brand embedded"),
        ("https://github.com/login", "Unrelated site"),
    ]

    for url, desc in tests:
        score, flags = compute_url_intelligence(url, official)
        print(f"\n{desc}: {url}")
        print(f"  Score: {score:.0f} (low = suspicious)")
        if flags:
            for f in flags:
                print(f"  ⚠ {f}")
