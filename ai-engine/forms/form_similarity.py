"""
ai-engine/forms/form_similarity.py
Compares form fingerprints between candidate and twin.
Includes hard penalty for external form action URL mismatches.
"""

from typing import Any
import difflib


def compute_form_similarity(
    candidate_form_fp: dict[str, Any],
    twin_dom_fp: dict[str, Any],
    candidate_domain: str = "",
    twin_domain: str = "",
) -> tuple[float, list[str]]:
    """
    Compare form structures and detect phishing indicators.

    Args:
        candidate_form_fp: Form fingerprint from evidence-engine/forms/form_extractor.py
        twin_dom_fp: DOM fingerprint from the digital twin
        candidate_domain: Domain of the candidate site
        twin_domain: Domain of the official twin site

    Returns:
        Tuple of (score: float 0-100, red_flags: list[str]).
        Higher score = forms look more alike = more suspicious.
        red_flags contains specific phishing indicators found.
    """
    red_flags: list[str] = []

    cand_forms = candidate_form_fp.get("forms", [])
    cand_form_count = candidate_form_fp.get("form_count", 0)
    twin_form_count = twin_dom_fp.get("form_count", 0)

    if cand_form_count == 0 and twin_form_count == 0:
        return 50.0, []  # Both have no forms — neutral

    if cand_form_count == 0:
        return 30.0, []  # Candidate has no forms — low similarity

    scores = []

    # ── 1. Form count match ──────────────────────────────────
    if twin_form_count > 0:
        count_sim = max(0, 100 - abs(cand_form_count - twin_form_count) * 30)
        scores.append(("count_match", count_sim, 0.15))
    else:
        scores.append(("count_match", 50.0, 0.15))

    # ── 2. Input count match ─────────────────────────────────
    cand_input_count = sum(f.get("input_count", 0) for f in cand_forms)
    twin_input_count = twin_dom_fp.get("input_count", 0)

    if twin_input_count > 0:
        input_sim = max(0, 100 - abs(cand_input_count - twin_input_count) * 20)
        scores.append(("input_match", input_sim, 0.15))
    else:
        scores.append(("input_match", 50.0, 0.15))

    # ── 3. Field type sequence matching ──────────────────────
    # Compare the sequence of field types (e.g., [text, password] = login pattern)
    best_seq_score = 0.0
    for form in cand_forms:
        seq = form.get("field_type_sequence", [])
        if seq:
            # Common login pattern: text/email + password
            has_username = any(t in ("text", "email", "tel") for t in seq)
            has_password = any(t == "password" for t in seq)
            if has_username and has_password:
                best_seq_score = max(best_seq_score, 90.0)  # Login form pattern
            elif has_password:
                best_seq_score = max(best_seq_score, 70.0)

    scores.append(("field_sequence", best_seq_score, 0.20))

    # ── 4. Password field presence ───────────────────────────
    has_password = candidate_form_fp.get("has_password_field", False)
    password_score = 80.0 if has_password else 20.0
    scores.append(("has_password", password_score, 0.15))

    # ── 5. External form action — context-dependent penalty ────
    # This is only a strong phishing signal when the form ALSO contains
    # credential fields (password inputs).  A marketing/newsletter form
    # submitting to HubSpot, Mailchimp, etc. is NOT credential theft.
    if candidate_form_fp.get("has_external_action", False):
        external_domains = candidate_form_fp.get("external_action_domains", [])

        # Check if external domain is the twin's domain (that could be legitimate)
        is_submitting_to_twin = any(
            twin_domain and (d == twin_domain or d.endswith(f".{twin_domain}"))
            for d in external_domains
        )

        if not is_submitting_to_twin:
            if has_password:
                # HARD phishing indicator: login form submitting credentials to unknown server
                scores.append(("external_action", 100.0, 0.35))
                for d in external_domains:
                    red_flags.append(f"Credential Submission Redirected to Unknown Server ({d})")
            else:
                # Non-credential form with external action — low concern
                # (newsletter signups, contact forms, etc.)
                scores.append(("external_action", 40.0, 0.35))
        else:
            scores.append(("external_action", 30.0, 0.35))
    elif candidate_form_fp.get("has_safe_external_action", False):
        # Forms submit to known safe SaaS providers (HubSpot, Mailchimp, etc.)
        # Not a phishing indicator at all
        scores.append(("external_action", 20.0, 0.35))
    else:
        scores.append(("external_action", 50.0, 0.35))

    # ── 6. "Remember me" / "Forgot password" heuristics ─────
    has_remember = any(f.get("has_remember_me", False) for f in cand_forms)
    if has_remember:
        # Login-like form characteristics present
        scores[-1] = (scores[-1][0], min(scores[-1][1] + 5, 100.0), scores[-1][2])

    # Weighted sum
    total = sum(s * w for _, s, w in scores)
    total_weight = sum(w for _, _, w in scores)
    final_score = total / total_weight if total_weight > 0 else 50.0

    return float(max(0.0, min(100.0, final_score))), red_flags


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    # Suspicious: external form action
    cand_fp = {
        "form_count": 1,
        "forms": [{
            "action": "https://evil-server.xyz/steal",
            "action_is_external": True,
            "input_count": 2,
            "field_type_sequence": ["text", "password"],
            "has_password": True,
            "has_remember_me": True,
        }],
        "has_password_field": True,
        "has_external_action": True,
        "external_action_domains": ["evil-server.xyz"],
    }

    twin_fp = {"form_count": 1, "input_count": 2}

    score, flags = compute_form_similarity(cand_fp, twin_fp, "fake-login.com", "university.edu")
    print(f"Score: {score:.1f}")
    print(f"Red flags: {flags}")
