"""
digital-twin/embeddings/clip_embedder.py
CLIP visual embedding singleton — loads the model once and caches it in memory.
Used for both full-page screenshots and cropped logos.

Uses HuggingFace transformers with openai/clip-vit-base-patch32 (pre-trained,
no training required — Chapter 8.13 of spec).
"""

import os
import ssl
import numpy as np
from pathlib import Path
from PIL import Image
from typing import Optional

os.environ["PYTHONHTTPSVERIFY"] = "0"
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""
try:
    ssl._create_default_https_context = ssl._create_unverified_context
except Exception:
    pass

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from shared.config import CLIP_MODEL_NAME

# ── Singleton model cache ─────────────────────────────────────
_model = None
_processor = None
_load_attempted = False


def _load_model():
    """Load CLIP model and processor once, cache globally."""
    global _model, _processor, _load_attempted
    if _model is None and not _load_attempted:
        _load_attempted = True
        try:
            from transformers import CLIPModel, CLIPProcessor
            print(f"[CLIP] Loading model: {CLIP_MODEL_NAME} ...")
            _processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
            _model = CLIPModel.from_pretrained(CLIP_MODEL_NAME)
            _model.eval()
            print("[CLIP] Model loaded and cached.")
        except Exception as e:
            print(f"[CLIP] Warning: Failed to load CLIP model ({e}). Falling back to structural DOM analysis.")
            _model = None
            _processor = None
    return _model, _processor


def get_image_embedding(image_path: str) -> Optional[np.ndarray]:
    """
    Generate a 512-dimensional CLIP embedding for an image.

    Args:
        image_path: Path to a PNG/JPG image file.

    Returns:
        np.ndarray of shape (512,) with float32 values,
        or None if the image cannot be loaded.
    """
    if not Path(image_path).exists():
        print(f"[CLIP] Image not found: {image_path}")
        return None

    try:
        image = Image.open(image_path).convert("RGB")
    except Exception as e:
        print(f"[CLIP] Failed to open image {image_path}: {e}")
        return None

    model, processor = _load_model()
    if model is None or processor is None:
        return None

    import torch
    with torch.no_grad():
        inputs = processor(images=image, return_tensors="pt")
        outputs = model.get_image_features(**inputs)
        if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
            feat = outputs.pooler_output
        elif hasattr(outputs, "image_embeds") and outputs.image_embeds is not None:
            feat = outputs.image_embeds
        elif isinstance(outputs, torch.Tensor):
            feat = outputs
        else:
            feat = outputs[0]

        embedding = feat.squeeze().cpu().numpy()
        if embedding.ndim > 1:
            embedding = embedding.flatten()
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

    return embedding.astype(np.float32)


def get_text_embedding(text: str) -> np.ndarray:
    """
    Generate a CLIP text embedding (for future text-based similarity).
    Not used in MVP but included for completeness.

    TODO: Use this for comparing page titles / meta descriptions
    against official institutional text.
    """
    model, processor = _load_model()
    if model is None or processor is None:
        return np.zeros(512, dtype=np.float32)

    import torch
    with torch.no_grad():
        inputs = processor(text=[text], return_tensors="pt", padding=True)
        outputs = model.get_text_features(**inputs)
        if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
            feat = outputs.pooler_output
        elif hasattr(outputs, "text_embeds") and outputs.text_embeds is not None:
            feat = outputs.text_embeds
        elif isinstance(outputs, torch.Tensor):
            feat = outputs
        else:
            feat = outputs[0]

        embedding = feat.squeeze().cpu().numpy()
        if embedding.ndim > 1:
            embedding = embedding.flatten()
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

    return embedding.astype(np.float32)



def embedding_to_list(emb: Optional[np.ndarray]) -> list[float]:
    """Convert numpy embedding to plain Python list for JSON serialization."""
    if emb is None:
        return []
    return [float(x) for x in emb.tolist()]


def list_to_embedding(lst: list[float]) -> Optional[np.ndarray]:
    """Convert a JSON-serialized list back to numpy array."""
    if not lst:
        return None
    return np.array(lst, dtype=np.float32)


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    print("CLIP Embedder — Standalone Test")
    print(f"Model: {CLIP_MODEL_NAME}")

    # Try to embed a test image if one exists
    import os
    test_paths = [
        "digital-twin/storage/screenshots/github_com.png",
        "test_image.png",
    ]
    for tp in test_paths:
        if os.path.exists(tp):
            emb = get_image_embedding(tp)
            if emb is not None:
                print(f"Embedding for {tp}: shape={emb.shape}, norm={np.linalg.norm(emb):.4f}")
                print(f"First 5 values: {emb[:5]}")
            break
    else:
        print("No test image found. Run render.py first to capture a screenshot.")
        # Just test model loading
        _load_model()
        print("Model loaded successfully!")
