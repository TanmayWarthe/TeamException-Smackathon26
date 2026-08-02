"""
ai-engine/logo/logo_similarity.py
Compares CLIP logo embeddings between candidate and twin.
Returns a float 0-100 representing logo similarity.
"""

import numpy as np
from typing import Optional


def compute_logo_similarity(
    candidate_logo_embedding: Optional[np.ndarray],
    twin_logo_embedding: Optional[np.ndarray],
) -> float:
    """
    Cosine similarity between CLIP logo embeddings, scaled to [0, 100].

    Args:
        candidate_logo_embedding: 512-dim CLIP embedding of candidate logo.
        twin_logo_embedding: 512-dim CLIP embedding of official twin logo.

    Returns:
        float in [0, 100]. Higher = logos look more alike.
        Returns 40.0 (low-confidence) if either logo embedding is missing,
        rather than crashing — the scoring engine uses this to reduce confidence.
    """
    if candidate_logo_embedding is None or twin_logo_embedding is None:
        # No logo detected on one or both sites.
        # Return 40 (below suspicious threshold) to avoid false positives,
        # but flag this as low-confidence data for the risk engine.
        return 40.0

    c = candidate_logo_embedding.flatten().astype(np.float64)
    t = twin_logo_embedding.flatten().astype(np.float64)

    norm_c = np.linalg.norm(c)
    norm_t = np.linalg.norm(t)

    if norm_c == 0 or norm_t == 0:
        return 40.0

    cosine = np.dot(c, t) / (norm_c * norm_t)

    # Scale from [-1, 1] to [0, 100]
    score = (cosine + 1.0) * 50.0

    return float(max(0.0, min(100.0, score)))


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    a = np.random.randn(512).astype(np.float32)
    a /= np.linalg.norm(a)

    print(f"Identical logos:  {compute_logo_similarity(a, a):.1f}")

    b = a + np.random.randn(512) * 0.05
    b = (b / np.linalg.norm(b)).astype(np.float32)
    print(f"Similar logos:    {compute_logo_similarity(a, b):.1f}")

    c = np.random.randn(512).astype(np.float32)
    c /= np.linalg.norm(c)
    print(f"Random logos:     {compute_logo_similarity(a, c):.1f}")

    print(f"Missing logo:     {compute_logo_similarity(None, a):.1f}")
