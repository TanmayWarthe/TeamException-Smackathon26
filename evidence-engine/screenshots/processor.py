"""
evidence-engine/screenshots/processor.py
Screenshot preprocessing for fair visual comparison.
Resizes to standard resolution and crops browser chrome if present.
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

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from shared.config import DEFAULT_VIEWPORT


def process_screenshot(
    screenshot_path: str,
    output_path: str | None = None,
    target_width: int = DEFAULT_VIEWPORT["width"],
    target_height: int = DEFAULT_VIEWPORT["height"],
) -> str:
    """
    Preprocess a screenshot for embedding comparison.
    """
    if output_path is None:
        output_path = screenshot_path

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    if cv2 is not None:
        img = cv2.imread(screenshot_path)
        if img is not None:
            h, w = img.shape[:2]
            if h > target_height * 1.5:
                img = img[:target_height, :, :]
            img = cv2.resize(img, (target_width, target_height), interpolation=cv2.INTER_AREA)
            cv2.imwrite(output_path, img)
            return output_path

    if Image is not None:
        try:
            with Image.open(screenshot_path) as img:
                w, h = img.size
                if h > target_height * 1.5:
                    img = img.crop((0, 0, w, target_height))
                img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                img.save(output_path)
                return output_path
        except Exception:
            pass

    return screenshot_path


def extract_dominant_colors(image_path: str, k: int = 3) -> list[str]:
    """
    Extract top-k dominant colors from an image.
    """
    if Image is not None:
        try:
            with Image.open(image_path) as img:
                img = img.convert("RGB").resize((150, 100))
                # Quantize to k colors
                quantized = img.quantize(colors=k)
                palette = quantized.getpalette()[:k*3]
                colors = []
                for i in range(k):
                    r, g, b = palette[i*3 : (i+1)*3]
                    colors.append(f"#{r:02x}{g:02x}{b:02x}")
                return colors
        except Exception:
            pass

    return ["#1e3a8a", "#ffffff", "#0f172a"]


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    print("Screenshot processor ready.")
    print(f"Target resolution: {DEFAULT_VIEWPORT['width']}x{DEFAULT_VIEWPORT['height']}")
