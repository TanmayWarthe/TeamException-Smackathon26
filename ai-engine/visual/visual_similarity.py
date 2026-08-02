"""
ai-engine/visual/visual_similarity.py
Compares CLIP visual embeddings of candidate vs twin screenshots.
Returns a float 0-100 representing visual similarity.
"""

import numpy as np
from typing import Optional


def compute_visual_similarity(
    candidate_embedding: Optional[np.ndarray],
    twin_embedding: Optional[np.ndarray],
) -> float:
    """
    Cosine similarity between CLIP visual embeddings, scaled from [-1,1] to [0,100].

    Args:
        candidate_embedding: 512-dim CLIP embedding of candidate screenshot.
        twin_embedding: 512-dim CLIP embedding of official twin screenshot.

    Returns:
        float in [0, 100]. Higher = more visually similar = more suspicious.
        Returns 50.0 (neutral) if either embedding is missing.
    """
    if candidate_embedding is None or twin_embedding is None:
        # Fallback: neutral score when data is missing
        # Code comment: This prevents crashes when screenshots fail to capture.
        # A neutral 50 means "inconclusive — don't penalize but don't trust either."
        return 50.0

    # Ensure 1D
    c = candidate_embedding.flatten().astype(np.float64)
    t = twin_embedding.flatten().astype(np.float64)

    # Cosine similarity
    dot = np.dot(c, t)
    norm_c = np.linalg.norm(c)
    norm_t = np.linalg.norm(t)

    if norm_c == 0 or norm_t == 0:
        return 50.0

    cosine = dot / (norm_c * norm_t)

    # Scale from [-1, 1] to [0, 100]
    # cosine = -1 → 0  (completely different)
    # cosine =  0 → 50 (unrelated)
    # cosine =  1 → 100 (identical)
    score = float((cosine + 1.0) * 50.0)

    # Clamp to [0, 100]
    return float(max(0.0, min(100.0, score)))


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    # Test with random embeddings
    a = np.random.randn(512).astype(np.float32)
    a /= np.linalg.norm(a)

    # Identical
    print(f"Identical: {compute_visual_similarity(a, a):.1f}")

    # Slightly different
    b = a + np.random.randn(512).astype(np.float32) * 0.1
    b /= np.linalg.norm(b)
    print(f"Similar:   {compute_visual_similarity(a, b):.1f}")

    # Very different
    c = np.random.randn(512).astype(np.float32)
    c /= np.linalg.norm(c)
    print(f"Random:    {compute_visual_similarity(a, c):.1f}")

    # Missing data
    print(f"Missing:   {compute_visual_similarity(None, a):.1f}")
