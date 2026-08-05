"""
risk-engine/reports/explain.py
Generates the human-readable 'reasons' string array for the API response.

Rule-based: maps analyzer scores to natural-language explanations.
Ordered by contribution weight (most impactful reasons first).
Capped at 3-5 reasons to avoid overwhelming the UI.
"""

from typing import Any


# ── Reason templates keyed by analyzer ───────────────────────
# Each entry: (threshold, reason_text)
# If analyzer score exceeds threshold, include the reason.
_REASON_RULES = {
    "visual": [
        (90, "Visually near-identical to official portal"),
        (75, "High visual similarity to official site"),
        (55, "Visual layout resemblance to official portal"),
    ],
    "logo": [
        (90, "Copied Institutional Logo"),
        (75, "Logo closely resembles official branding"),
        (50, "Logo element detected with resemblance to official brand"),
    ],
    "dom": [
        (90, "Highly Similar DOM Structure"),
        (75, "Similar page structure to official site"),
        (50, "DOM structure shares layout patterns with official portal"),
    ],
    "form": [
        (80, "Suspicious Form Action"),
        (65, "Login form mimics official credential page"),
        (45, "Credential input fields detected on unverified domain"),
    ],
    "css": [
        (85, "Color scheme matches official branding"),
        (65, "Color palette resembles institutional portal"),
    ],
    # URL uses inverted scale — handled specially below
    "url_inverted": [
        (80, "Suspicious Domain Registration"),
        (60, "Domain name partially resembles official site"),
        (45, "Domain mismatch against official institutional domain"),
    ],
}


def generate_reasons(
    fused_scores: dict[str, Any],
    contributions: dict[str, Any],
    red_flags: list[str],
    max_reasons: int = 5,
    risk_score: float | None = None,
) -> list[str]:
    """
    Generate human-readable explanation reasons for the risk score.

    Args:
        fused_scores: Raw fused scores from feature_fusion.
        contributions: Per-analyzer contribution data from scoring engine.
        red_flags: Specific phishing indicators from form/URL analyzers.
        max_reasons: Maximum number of reasons to return (3-5).
        risk_score: Optional overall risk score (0-100) to ensure reason consistency.

    Returns:
        List of reason strings, ordered by impact (highest contribution first).
    """
    reasons_with_priority: list[tuple[float, str]] = []

    # ── Add red flags first (highest priority) ───────────────
    for flag in red_flags:
        reasons_with_priority.append((200.0, flag))  # Very high priority

    metadata = fused_scores.get("_metadata", {})
    cand_domain = (metadata.get("candidate_domain") or "").lower().strip()
    twin_domain = (metadata.get("twin_domain") or "").lower().strip()
    is_official = bool(cand_domain and twin_domain and (
        cand_domain == twin_domain or 
        cand_domain == f"www.{twin_domain}" or 
        cand_domain.endswith(f".{twin_domain}")
    ))

    # If verified official site with no malicious red flags, return positive verification
    if is_official and not red_flags:
        return [f"Verified official domain ({cand_domain})"]

    # ── Check each analyzer against thresholds ───────────────
    for analyzer, rules in _REASON_RULES.items():
        if analyzer == "url_inverted":
            # URL is inverted: low raw score = suspicious
            # Use the inverted score (100 - url_raw) for threshold checking
            raw_url = fused_scores.get("url", 50.0)
            score = 100.0 - raw_url
        else:
            score = fused_scores.get(analyzer, 0.0)

        # Get contribution weight for ordering
        contrib = contributions.get(analyzer, {}).get("contribution", 0.0)

        for threshold, reason_text in rules:
            if score >= threshold:
                # Don't add if a red_flag already covers this
                if not any(reason_text.lower() in rf.lower() or rf.lower() in reason_text.lower()
                           for rf in red_flags):
                    reasons_with_priority.append((contrib + score, reason_text))
                break  # Only use the first (highest threshold) match per analyzer

    # ── Sort by priority (descending) and deduplicate ────────
    reasons_with_priority.sort(key=lambda x: -x[0])

    seen = set()
    unique_reasons = []
    for _, reason in reasons_with_priority:
        normalized = reason.lower().strip()
        if normalized not in seen:
            seen.add(normalized)
            unique_reasons.append(reason)

    if not unique_reasons:
        risk_val = risk_score if risk_score is not None else sum(
            c.get("contribution", 0.0) for c in contributions.values()
        )

        if is_official and not red_flags and risk_val < 25:
            unique_reasons.append(f"Verified official domain ({cand_domain})")
        elif risk_val >= 71:
            unique_reasons.append("High risk indicators and structural impersonation detected on unverified domain")
        elif risk_val >= 41:
            if contributions.get("form", {}).get("contribution", 0) > 10:
                unique_reasons.append("Login form structure detected on unverified domain")
            elif contributions.get("dom", {}).get("contribution", 0) > 10:
                unique_reasons.append("Structural layout similarities detected on unverified domain")
            elif contributions.get("visual", {}).get("contribution", 0) > 10:
                unique_reasons.append("Visual appearance resembles official portal")
            else:
                unique_reasons.append("Suspicious structural patterns detected on unverified domain")
        elif risk_val >= 25:
            unique_reasons.append("Minor layout or styling similarities detected without active phishing indicators")
        else:
            unique_reasons.append("No active phishing indicators or suspicious redirects detected")

    return unique_reasons[:max_reasons]


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    fused = {
        "visual": 92, "dom": 88, "logo": 95, "form": 85,
        "css": 80, "url": 15, "ssl": 50, "javascript": 70,
    }

    contribs = {
        "visual": {"contribution": 23.0},
        "dom": {"contribution": 17.6},
        "form": {"contribution": 17.0},
        "logo": {"contribution": 9.5},
        "url": {"contribution": 4.25},
        "css": {"contribution": 0},
        "ssl": {"contribution": 0},
        "javascript": {"contribution": 0},
    }

    flags = ["Credential Submission Redirected to Unknown Server (evil.xyz)"]

    reasons = generate_reasons(fused, contribs, flags)
    print("Generated reasons:")
    for i, r in enumerate(reasons, 1):
        print(f"  {i}. {r}")
