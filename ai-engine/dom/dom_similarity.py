"""
ai-engine/dom/dom_similarity.py
Compares DOM fingerprint dicts between candidate and twin.
Returns a float 0-100 representing structural similarity.
"""

import numpy as np
from typing import Any


def compute_dom_similarity(
    candidate_fp: dict[str, Any],
    twin_fp: dict[str, Any],
) -> float:
    """
    Weighted average of multiple DOM structural metrics.

    Components:
        1. Tag frequency vector cosine similarity (weight: 0.4)
        2. Form/input count match bonus (weight: 0.25)
        3. DOM depth closeness (weight: 0.15)
        4. Structural landmark overlap (weight: 0.2)

    Args:
        candidate_fp: DOM fingerprint from evidence-engine.
        twin_fp: DOM fingerprint from digital-twin.

    Returns:
        float in [0, 100]. Higher = more structurally similar.
    """
    if not candidate_fp or not twin_fp:
        return 40.0  # Fallback: low-confidence neutral

    scores = {}

    # ── 1. Tag frequency cosine similarity (0.4 weight) ──────
    scores["tag_freq"] = _tag_frequency_similarity(
        candidate_fp.get("tag_frequency", {}),
        twin_fp.get("tag_frequency", {}),
    )

    # ── 2. Form/input count match (0.25 weight) ─────────────
    scores["form_match"] = _count_match_score(
        candidate_fp.get("form_count", 0),
        twin_fp.get("form_count", 0),
        candidate_fp.get("input_count", 0),
        twin_fp.get("input_count", 0),
    )

    # ── 3. DOM depth closeness (0.15 weight) ─────────────────
    scores["depth"] = _depth_closeness(
        candidate_fp.get("dom_depth", 0),
        twin_fp.get("dom_depth", 0),
    )

    # ── 4. Structural landmarks (0.2 weight) ────────────────
    scores["landmarks"] = _landmark_overlap(candidate_fp, twin_fp)

    # Weighted average
    weights = {"tag_freq": 0.4, "form_match": 0.25, "depth": 0.15, "landmarks": 0.2}
    total = sum(scores[k] * weights[k] for k in weights)

    return float(max(0.0, min(100.0, total)))


def _tag_frequency_similarity(tags_a: dict, tags_b: dict) -> float:
    """Cosine similarity treating tag counts as vectors."""
    all_tags = set(tags_a.keys()) | set(tags_b.keys())
    if not all_tags:
        return 50.0

    vec_a = np.array([tags_a.get(t, 0) for t in all_tags], dtype=np.float64)
    vec_b = np.array([tags_b.get(t, 0) for t in all_tags], dtype=np.float64)

    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    cosine = np.dot(vec_a, vec_b) / (norm_a * norm_b)
    # Scale cosine [0, 1] → [0, 100] (tag frequencies are non-negative, so cosine >= 0)
    return float(cosine * 100.0)


def _count_match_score(
    cand_forms: int, twin_forms: int,
    cand_inputs: int, twin_inputs: int,
) -> float:
    """Score based on how closely form/input counts match."""
    if twin_forms == 0 and cand_forms == 0:
        return 50.0  # Both have no forms — neutral

    form_sim = 100.0 if twin_forms == cand_forms else max(0, 100 - abs(twin_forms - cand_forms) * 25)
    input_sim = 100.0 if twin_inputs == cand_inputs else max(0, 100 - abs(twin_inputs - cand_inputs) * 15)

    return (form_sim * 0.6 + input_sim * 0.4)


def _depth_closeness(depth_a: int, depth_b: int) -> float:
    """Score based on how close DOM depths are."""
    if depth_a == 0 and depth_b == 0:
        return 50.0
    max_depth = max(depth_a, depth_b, 1)
    diff = abs(depth_a - depth_b)
    return float(max(0, 100 - (diff / max_depth) * 100))


def _landmark_overlap(fp_a: dict, fp_b: dict) -> float:
    """Score based on shared structural landmarks (nav, header, footer)."""
    landmarks = ["has_nav", "has_header", "has_footer"]
    matches = sum(1 for l in landmarks if fp_a.get(l) == fp_b.get(l))
    return float(matches / len(landmarks) * 100)


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    twin_fp = {
        "element_count": 340, "form_count": 1, "input_count": 3,
        "dom_depth": 12, "tag_frequency": {"div": 120, "span": 45, "input": 3, "form": 1},
        "has_nav": True, "has_header": True, "has_footer": True,
    }

    # Nearly identical
    cand_fp_similar = {
        "element_count": 338, "form_count": 1, "input_count": 3,
        "dom_depth": 12, "tag_frequency": {"div": 118, "span": 44, "input": 3, "form": 1},
        "has_nav": True, "has_header": True, "has_footer": True,
    }

    # Very different
    cand_fp_different = {
        "element_count": 50, "form_count": 0, "input_count": 0,
        "dom_depth": 4, "tag_frequency": {"div": 10, "p": 20},
        "has_nav": False, "has_header": False, "has_footer": False,
    }

    print(f"Similar DOM:   {compute_dom_similarity(cand_fp_similar, twin_fp):.1f}")
    print(f"Different DOM: {compute_dom_similarity(cand_fp_different, twin_fp):.1f}")
