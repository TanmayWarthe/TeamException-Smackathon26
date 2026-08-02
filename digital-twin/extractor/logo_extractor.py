"""
digital-twin/extractor/logo_extractor.py
Heuristic logo detection: finds the largest <img> near the top of the page
(within the first LOGO_SEARCH_VERTICAL_LIMIT_PX pixels or inside <header>/<nav>)
and crops that region from the full-page screenshot using OpenCV.
"""

try:
    import cv2
except ImportError:
    cv2 = None

try:
    from PIL import Image
except ImportError:
    Image = None

import numpy as np
from pathlib import Path
from typing import Any

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from shared.config import LOGO_SEARCH_VERTICAL_LIMIT_PX, LOGO_MIN_SIZE_PX, LOGOS_DIR, sanitize_domain


def extract_logo(
    screenshot_path: str,
    img_elements: list[dict[str, Any]],
    domain: str,
    logo_save_path: str | None = None,
) -> str | None:
    """
    Detect and crop the most likely logo from a screenshot.

    Args:
        screenshot_path: Path to the full-page screenshot PNG.
        img_elements: List of img element dicts from render.py
                      (each has src, alt, className, x, y, width, height).
        domain: Domain name (used for default save filename).
        logo_save_path: Where to save the cropped logo. If None,
                        auto-generates in LOGOS_DIR.

    Returns:
        Path to the cropped logo PNG, or None if no logo detected.
    """
    if not img_elements:
        return None

    # Filter: only images in the top region of the page
    candidates = []
    for img in img_elements:
        y = img.get("y", 9999)
        w = img.get("width", 0)
        h = img.get("height", 0)
        src = img.get("src", "")
        alt = (img.get("alt", "") or "").lower()
        cls = (img.get("className", "") or "").lower()

        # Must be in top portion of page
        if y > LOGO_SEARCH_VERTICAL_LIMIT_PX:
            continue

        # Must meet minimum size
        if w < LOGO_MIN_SIZE_PX or h < LOGO_MIN_SIZE_PX:
            continue

        # Score: prefer images with "logo" in alt/class/src, and larger images
        score = w * h  # base score = area
        if "logo" in alt or "logo" in cls or "logo" in src.lower():
            score *= 3  # strong boost for explicit logo hints
        if "brand" in alt or "brand" in cls:
            score *= 2
        if "icon" in alt or "icon" in cls:
            score *= 1.5

        candidates.append({**img, "score": score})

    if not candidates:
        return None

    # Pick the best candidate
    best = max(candidates, key=lambda c: c["score"])

    # Determine save path
    if logo_save_path is None:
        LOGOS_DIR.mkdir(parents=True, exist_ok=True)
        logo_save_path = str(LOGOS_DIR / f"{sanitize_domain(domain)}_logo.png")

    Path(logo_save_path).parent.mkdir(parents=True, exist_ok=True)

    if cv2 is not None:
        screenshot = cv2.imread(screenshot_path)
        if screenshot is None:
            return None
        img_h, img_w = screenshot.shape[:2]
        x = max(0, int(best["x"]))
        y = max(0, int(best["y"]))
        w = min(int(best["width"]), img_w - x)
        h = min(int(best["height"]), img_h - y)
        if w <= 0 or h <= 0:
            return None
        cropped = screenshot[y:y + h, x:x + w]
        cv2.imwrite(logo_save_path, cropped)
        return logo_save_path
    elif Image is not None:
        try:
            with Image.open(screenshot_path) as img:
                img_w, img_h = img.size
                x = max(0, int(best["x"]))
                y = max(0, int(best["y"]))
                w = min(int(best["width"]), img_w - x)
                h = min(int(best["height"]), img_h - y)
                if w <= 0 or h <= 0:
                    return None
                cropped = img.crop((x, y, x + w, y + h))
                cropped.save(logo_save_path)
                return logo_save_path
        except Exception:
            return None

    return None


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    # Requires a screenshot to already exist
    test_elements = [
        {"src": "https://example.com/logo.png", "alt": "Company Logo",
         "className": "site-logo", "x": 20, "y": 15, "width": 150, "height": 50},
        {"src": "https://example.com/banner.jpg", "alt": "",
         "className": "", "x": 0, "y": 200, "width": 1280, "height": 300},
    ]
    print("Logo extractor ready. Requires a screenshot file to test.")
    print(f"Best candidate would be: {max(test_elements, key=lambda e: e.get('width', 0) * e.get('height', 0))['src']}")
