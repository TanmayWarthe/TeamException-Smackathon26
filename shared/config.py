"""
shared/config.py
Central configuration for the CTIP AI/ML pipeline.
All storage paths, constants, and model references defined once here.
"""

import os
from pathlib import Path

# ── Project root (monorepo root) ──────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# ── Storage directories ──────────────────────────────────────
STORAGE_DIR = PROJECT_ROOT / "digital-twin" / "storage"
SCREENSHOTS_DIR = STORAGE_DIR / "screenshots"
LOGOS_DIR = STORAGE_DIR / "logos"
TWINS_DIR = STORAGE_DIR / "twins"
EMBEDDINGS_DIR = STORAGE_DIR / "embeddings"

# Create storage dirs on import
for d in [SCREENSHOTS_DIR, LOGOS_DIR, TWINS_DIR, EMBEDDINGS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ── CLIP Model ────────────────────────────────────────────────
# Pre-trained model — no training required (Chapter 8.13)
CLIP_MODEL_NAME = "openai/clip-vit-base-patch32"

# ── Screenshot / rendering defaults ──────────────────────────
DEFAULT_VIEWPORT = {"width": 1280, "height": 800}
SCREENSHOT_FULL_PAGE = True
RENDER_WAIT_MS = 3000  # wait for JS rendering before capture

# ── Logo detection heuristics ─────────────────────────────────
LOGO_SEARCH_VERTICAL_LIMIT_PX = 600  # only search top 600px for logos
LOGO_MIN_SIZE_PX = 20                 # ignore tiny images

# ── Scoring weights (Chapter 8.4 of spec) ────────────────────
# Imported by risk-engine/scoring/weights.py — defined once here too
# so it's a single source of truth for anyone who needs them.
ANALYSIS_WEIGHTS = {
    "visual":     0.25,
    "dom":        0.20,
    "form":       0.20,
    "logo":       0.10,
    "url":        0.05,
    "ssl":        0.05,
    "javascript": 0.15,
}

# ── Risk thresholds ───────────────────────────────────────────
RISK_THRESHOLDS = [
    (25,  "TRUSTED",    "ALLOW"),
    (50,  "LOW_RISK",   "ALLOW"),
    (70,  "SUSPICIOUS", "WARN"),
    (90,  "HIGH_RISK",  "WARN"),
    (100, "CRITICAL",   "BLOCK"),
]

# ── Suspicious TLDs (for URL intelligence) ───────────────────
SUSPICIOUS_TLDS = {
    ".xyz", ".top", ".site", ".club", ".click", ".work", ".buzz",
    ".gq", ".ml", ".cf", ".tk", ".ga", ".icu", ".cam", ".rest",
    ".monster", ".quest", ".surf", ".sbs", ".bond",
}

# ── Playwright browser config ────────────────────────────────
BROWSER_HEADLESS = True
BROWSER_TIMEOUT_MS = 6_000

# ── Domain sanitization for filenames ─────────────────────────
def sanitize_domain(domain: str) -> str:
    """Convert a domain like 'ycce.edu' to 'ycce_edu'."""
    return domain.replace(".", "_").replace("/", "_").replace(":", "_")
