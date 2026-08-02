"""
ai-engine/css/css_similarity.py
Compares dominant color palettes extracted from screenshots.
Uses color distance in LAB space for perceptual accuracy.
"""

import numpy as np
from typing import Optional


def compute_css_similarity(
    candidate_colors: list[str],
    twin_colors: list[str],
) -> float:
    """
    Compare dominant color palettes using color distance.

    Args:
        candidate_colors: Hex color strings from candidate screenshot.
        twin_colors: Hex color strings from twin screenshot.

    Returns:
        float in [0, 100]. Higher = color palettes are more similar.
    """
    if not candidate_colors or not twin_colors:
        return 50.0  # Fallback: inconclusive

    try:
        cand_rgb = [_hex_to_rgb(c) for c in candidate_colors if c]
        twin_rgb = [_hex_to_rgb(c) for c in twin_colors if c]
    except (ValueError, TypeError):
        return 50.0

    if not cand_rgb or not twin_rgb:
        return 50.0

    # Convert to LAB for perceptual distance
    cand_lab = [_rgb_to_lab(r, g, b) for r, g, b in cand_rgb]
    twin_lab = [_rgb_to_lab(r, g, b) for r, g, b in twin_rgb]

    # For each candidate color, find the closest twin color (and vice versa)
    total_dist = 0.0
    count = 0

    for cl in cand_lab:
        min_dist = min(_lab_distance(cl, tl) for tl in twin_lab)
        total_dist += min_dist
        count += 1

    for tl in twin_lab:
        min_dist = min(_lab_distance(tl, cl) for cl in cand_lab)
        total_dist += min_dist
        count += 1

    avg_dist = total_dist / max(count, 1)

    # Map distance to similarity: 0 distance → 100, large distance → 0
    # CIE ΔE of ~2.3 is "just noticeable difference"
    # ΔE of ~50+ is "very different"
    max_meaningful_dist = 80.0
    similarity = max(0, 100 - (avg_dist / max_meaningful_dist) * 100)

    return float(max(0.0, min(100.0, similarity)))


def _hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    """Convert '#1e3a8a' to (30, 58, 138)."""
    h = hex_str.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _rgb_to_lab(r: int, g: int, b: int) -> tuple[float, float, float]:
    """Convert RGB to CIE LAB color space (simplified)."""
    # Normalize to [0, 1]
    r_n, g_n, b_n = r / 255.0, g / 255.0, b / 255.0

    # Linearize (sRGB gamma)
    def linearize(v):
        return ((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92

    r_l = linearize(r_n)
    g_l = linearize(g_n)
    b_l = linearize(b_n)

    # To XYZ (D65 illuminant)
    x = r_l * 0.4124564 + g_l * 0.3575761 + b_l * 0.1804375
    y = r_l * 0.2126729 + g_l * 0.7151522 + b_l * 0.0721750
    z = r_l * 0.0193339 + g_l * 0.1191920 + b_l * 0.9503041

    # Normalize by D65 white point
    x /= 0.95047
    y /= 1.0
    z /= 1.08883

    def f(t):
        return t ** (1/3) if t > 0.008856 else (7.787 * t + 16/116)

    l = 116 * f(y) - 16
    a = 500 * (f(x) - f(y))
    b_val = 200 * (f(y) - f(z))

    return l, a, b_val


def _lab_distance(lab1: tuple, lab2: tuple) -> float:
    """Euclidean distance in LAB space (CIE76 ΔE)."""
    return float(np.sqrt(sum((a - b) ** 2 for a, b in zip(lab1, lab2))))


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    # Same palette
    p1 = ["#1e3a8a", "#ffffff", "#f0f0f0"]
    p2 = ["#1e3b8c", "#fefefe", "#efefef"]
    print(f"Similar palettes: {compute_css_similarity(p1, p2):.1f}")

    # Very different
    p3 = ["#ff0000", "#00ff00", "#0000ff"]
    print(f"Different palettes: {compute_css_similarity(p1, p3):.1f}")

    # Missing
    print(f"Missing data: {compute_css_similarity([], p1):.1f}")
