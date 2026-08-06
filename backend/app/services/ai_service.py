"""
backend/app/services/ai_service.py

Bridge between FastAPI routes and the CTIP AI/ML pipeline.

Two analysis entry points:
  - run_ai_analysis_from_html(url, html, twin_domain)
      Primary path: caller supplies HTML directly (Chrome extension, Swagger UI).
      Skips Playwright rendering — uses submitted HTML for DOM + form analysis.
      Visual/logo CLIP scores default to neutral 50 when no screenshot is available.

  - run_ai_analysis(url, twin_domain)
      Legacy path: fetches and renders the URL via the evidence-engine pipeline.
      Requires Playwright + CLIP.  Falls back to run_ai_analysis_from_html
      with empty HTML on render failure.

Both functions return the standard API dict:
    {
        "status": str,        # UNKNOWN | TRUSTED | LOW_RISK | SUSPICIOUS | HIGH_RISK | CRITICAL
        "risk_score": int,    # 0-100
        "confidence": int,    # 0-100
        "recommendation": str,# ALLOW | WARN | BLOCK
        "reasons": list[str],
        "details": dict       # fused scores + metadata (not sent to frontend)
    }

IMPORTANT — no-twin case:
    If no Digital Twin is registered for twin_domain, BOTH functions return:
        status=UNKNOWN, risk_score=0, confidence=0,
        reasons=["No official Digital Twin registered for comparison"]
    This is NEVER a HIGH_RISK fabrication.
"""

import sys
import importlib.util
import traceback
from pathlib import Path
from typing import Any, Optional

# ── Path setup ────────────────────────────────────────────────
_project_root = Path(__file__).resolve().parent.parent.parent.parent


def _load_mod(name: str, path: Path):
    """Dynamically load a module from a path (handles hyphenated dir names)."""
    if not path.exists():
        raise FileNotFoundError(f"[AIService] Module not found: {path}")
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ── Lazy module cache ─────────────────────────────────────────
_twin_store_mod = None
_dom_extractor_mod = None
_form_extractor_mod = None
_feature_fusion_mod = None
_scoring_mod = None
_categorize_mod = None
_explain_mod = None
_evidence_pipeline_mod = None
_fingerprint_mod = None


def _get_twin_store():
    global _twin_store_mod
    if _twin_store_mod is None:
        _twin_store_mod = _load_mod(
            "twin_store",
            _project_root / "digital-twin" / "storage" / "twin_store.py"
        )
    return _twin_store_mod


def _get_dom_extractor():
    global _dom_extractor_mod
    if _dom_extractor_mod is None:
        _dom_extractor_mod = _load_mod(
            "dom_extractor",
            _project_root / "digital-twin" / "extractor" / "dom_extractor.py"
        )
    return _dom_extractor_mod


def _get_form_extractor():
    global _form_extractor_mod
    if _form_extractor_mod is None:
        _form_extractor_mod = _load_mod(
            "form_extractor",
            _project_root / "evidence-engine" / "forms" / "form_extractor.py"
        )
    return _form_extractor_mod


def _get_feature_fusion():
    global _feature_fusion_mod
    if _feature_fusion_mod is None:
        _feature_fusion_mod = _load_mod(
            "feature_fusion",
            _project_root / "ai-engine" / "fusion" / "feature_fusion.py"
        )
    return _feature_fusion_mod


def _get_scoring():
    global _scoring_mod
    if _scoring_mod is None:
        _scoring_mod = _load_mod(
            "scoring_engine",
            _project_root / "risk-engine" / "scoring" / "engine.py"
        )
    return _scoring_mod


def _get_categorize():
    global _categorize_mod
    if _categorize_mod is None:
        _categorize_mod = _load_mod(
            "categorize",
            _project_root / "risk-engine" / "thresholds" / "categorize.py"
        )
    return _categorize_mod


def _get_explain():
    global _explain_mod
    if _explain_mod is None:
        _explain_mod = _load_mod(
            "explain",
            _project_root / "risk-engine" / "reports" / "explain.py"
        )
    return _explain_mod


def _get_evidence_pipeline():
    global _evidence_pipeline_mod
    if _evidence_pipeline_mod is None:
        _evidence_pipeline_mod = _load_mod(
            "evidence_pipeline",
            _project_root / "evidence-engine" / "pipeline.py"
        )
    return _evidence_pipeline_mod


def _get_fingerprint():
    global _fingerprint_mod
    if _fingerprint_mod is None:
        _fingerprint_mod = _load_mod(
            "fingerprint",
            _project_root / "digital-twin" / "generator" / "fingerprint.py"
        )
    return _fingerprint_mod


# ── No-twin sentinel response ─────────────────────────────────
def _no_twin_response(twin_domain: str) -> dict[str, Any]:
    """
    Returned when no Digital Twin is registered for the given domain.
    Never fabricates a risk score — reports UNKNOWN honestly.
    """
    return {
        "status": "UNKNOWN",
        "risk_score": 0,
        "confidence": 0,
        "recommendation": "ALLOW",
        "reasons": [
            f"No official Digital Twin registered for '{twin_domain}'. "
            "Generate one via the Admin panel before analysis can be meaningful."
        ],
        "details": {
            "fused_scores": {},
            "component_contributions": {},
            "red_flags": [],
            "candidate_domain": "",
            "twin_domain": twin_domain,
            "no_twin": True,
        },
    }


# ── Shared AI Evaluation Pipeline ─────────────────────────────
def _evaluate_candidate_evidence(
    candidate_evidence: dict[str, Any],
    twin_domain: str = "ycce.edu",
    analysis_type: str = "HTML",
) -> dict[str, Any]:
    """
    Unified AI analysis evaluation pipeline.
    Takes structured candidate evidence (from HTML or Playwright) and runs:
      1. Digital Twin loading
      2. Feature fusion (ai-engine)
      3. Risk scoring (risk-engine)
      4. Risk categorization (thresholds)
      5. Conditional reason generation (explain)
      6. Consistent console logging
    """
    candidate_url = (candidate_evidence.get("candidate_url") or "").strip()
    if candidate_url and not candidate_url.startswith(("http://", "https://")):
        candidate_url = f"https://{candidate_url}"

    raw_domain = (candidate_evidence.get("domain") or "").strip().lower()
    if not raw_domain or raw_domain == "unknown":
        from urllib.parse import urlparse
        raw_domain = (urlparse(candidate_url).hostname or candidate_url.replace("https://", "").replace("http://", "").split("/")[0]).lower()
    
    # Strip any port or whitespace
    candidate_domain = raw_domain.split(":")[0].strip()

    # ── 0. Institutional Allowlist & Global Public Domain Check ──
    INSTITUTIONAL_ROOTS = {"ycce.edu", "ycce.edu.in", "meghegroup.org", "nagpuruniversity.ac.in"}
    GLOBAL_PUBLIC_ALLOWLIST = {
        # Major tech platforms
        "github.com", "google.com", "microsoft.com", "stackoverflow.com",
        "linkedin.com", "apple.com", "amazon.com", "facebook.com", "twitter.com", "x.com",
        "instagram.com", "youtube.com", "reddit.com", "discord.com", "slack.com",
        "dropbox.com", "notion.so", "figma.com", "canva.com", "zoom.us",
        # Developer / open-source
        "jupyter.org", "python.org", "nodejs.org", "npmjs.com", "pypi.org",
        "rust-lang.org", "golang.org", "go.dev", "ruby-lang.org",
        "docker.com", "kubernetes.io", "terraform.io", "ansible.com",
        "gitlab.com", "bitbucket.org", "sourceforge.net", "codepen.io",
        "replit.com", "vercel.com", "netlify.com", "heroku.com",
        "digitalocean.com", "cloudflare.com", "fastly.com",
        "readthedocs.io", "docs.rs",
        # Encyclopedic / educational
        "wikipedia.org", "wikimedia.org", "medium.com", "substack.com",
        "mozilla.org", "w3.org", "w3schools.com", "mdn.io",
        "khanacademy.org", "coursera.org", "edx.org", "udemy.com",
        "mit.edu", "stanford.edu", "harvard.edu",
        # Cloud providers
        "aws.amazon.com", "cloud.google.com", "azure.microsoft.com",
        "firebase.google.com", "supabase.com", "mongodb.com",
        # Indian institutional / government
        "nic.in", "gov.in", "aicte-india.org", "ugc.ac.in",
    }

    # Auto-trust well-known institutional TLDs (.edu, .gov, .mil, .ac.in)
    TRUSTED_TLD_PATTERNS = (".edu", ".gov", ".mil", ".ac.in", ".edu.in", ".res.in")

    is_official_institutional = (
        candidate_domain in INSTITUTIONAL_ROOTS
        or any(candidate_domain.endswith("." + root) for root in INSTITUTIONAL_ROOTS)
    )
    is_global_public = (
        candidate_domain in GLOBAL_PUBLIC_ALLOWLIST
        or any(candidate_domain.endswith("." + domain) for domain in GLOBAL_PUBLIC_ALLOWLIST)
    )
    is_trusted_tld = any(
        candidate_domain.endswith(tld) for tld in TRUSTED_TLD_PATTERNS
    )

    if is_official_institutional or is_global_public or is_trusted_tld:
        domain_type = "campus" if is_official_institutional else ("educational/government" if is_trusted_tld else "global public")
        print(f"[AIService] '{candidate_domain}' is a verified {domain_type} domain.")
        return {
            "status": "TRUSTED",
            "risk_score": 0,
            "confidence": 99,
            "recommendation": "ALLOW",
            "reasons": [
                f"Verified official {domain_type} domain ({candidate_domain})"
            ],
            "details": {
                "fused_scores": {
                    "visual": 0.0,
                    "dom": 0.0,
                    "form": 0.0,
                    "url": 0.0,
                    "ssl": 0.0,
                    "logo": 0.0,
                    "javascript": 0.0,
                },
                "component_contributions": {},
                "red_flags": [],
                "candidate_domain": candidate_domain,
                "twin_domain": candidate_domain,
                "no_twin": False,
            },
        }

    # ── 1. Load Digital Twin ──────────────────────────────────
    try:
        twin_store = _get_twin_store()
        twin = twin_store.load_twin(twin_domain)
    except Exception as e:
        print(f"[AIService] ERROR loading twin store: {e}")
        traceback.print_exc()
        return _no_twin_response(twin_domain)

    if twin is None:
        print(f"[AIService] No twin registered for '{twin_domain}'. Returning UNKNOWN status.")
        return _no_twin_response(twin_domain)

    print(f"[AIService] Target twin: {twin_domain}")

    # ── 2. Run AI fusion ──────────────────────────────────────
    try:
        fusion_mod = _get_feature_fusion()
        fused_scores = fusion_mod.fuse(candidate_evidence, twin)
        print(f"[AIService] Fused scores: visual={fused_scores.get('visual', 0):.1f}, "
              f"dom={fused_scores.get('dom', 0):.1f}, "
              f"form={fused_scores.get('form', 0):.1f}, "
              f"url={fused_scores.get('url', 0):.1f}, "
              f"red_flags={fused_scores.get('red_flags', [])}")
    except Exception as e:
        print(f"[AIService] Fusion error: {e}")
        traceback.print_exc()
        raise

    # ── 3. Risk scoring ───────────────────────────────────────
    try:
        scoring_mod = _get_scoring()
        risk_result = scoring_mod.calculate_risk(fused_scores)

        categorize_mod = _get_categorize()
        category = categorize_mod.categorize_risk(risk_result["risk_score"])
    except Exception as e:
        print(f"[AIService] Scoring error: {e}")
        traceback.print_exc()
        raise

    # ── 4. Generate conditional reasons ──────────────────────
    try:
        explain_mod = _get_explain()
        reasons = explain_mod.generate_reasons(
            fused_scores=fused_scores,
            contributions=risk_result["component_contributions"],
            red_flags=fused_scores.get("red_flags", []),
            risk_score=risk_result["risk_score"],
        )
    except Exception as e:
        print(f"[AIService] Explain error: {e}")
        traceback.print_exc()
        reasons = fused_scores.get("red_flags", [])

    final_risk_score = int(round(risk_result["risk_score"]))
    print(f"[AIService] Result: status={category['status']}, "
          f"risk_score={final_risk_score}, "
          f"reasons={reasons}")

    return {
        "status": category["status"],
        "risk_score": final_risk_score,
        "confidence": int(round(risk_result["confidence"])),
        "recommendation": category["recommendation"],
        "reasons": reasons,
        "details": {
            "fused_scores": {
                k: float(v) for k, v in fused_scores.items()
                if isinstance(v, (int, float))
            },
            "component_contributions": {
                k: {kk: float(vv) for kk, vv in v.items()}
                for k, v in risk_result["component_contributions"].items()
            },
            "red_flags": fused_scores.get("red_flags", []),
            "candidate_domain": candidate_domain,
            "twin_domain": twin_domain,
        },
    }


# ── Main entry point: HTML-first analysis ─────────────────────
def run_ai_analysis_from_html(
    candidate_url: str,
    html: str,
    twin_domain: str = "ycce.edu",
) -> dict[str, Any]:
    """
    Analyse a candidate page using its submitted HTML directly.

    Does NOT require Playwright or CLIP (no browser rendering).
    Visual/logo similarity scores default to neutral (50) when no
    screenshot embedding is available.

    Args:
        candidate_url: The URL of the page being checked.
        html: The raw HTML of the candidate page.
        twin_domain: Domain of the Digital Twin to compare against.

    Returns:
        Standard analysis dict. If no twin exists → UNKNOWN result.
    """
    candidate_url = (candidate_url or "").strip()
    if candidate_url and not candidate_url.startswith(("http://", "https://")):
        candidate_url = f"https://{candidate_url}"

    print(f"\n[AIService] HTML-based analysis: {candidate_url}")
    print(f"[AIService] HTML length: {len(html)} chars")

    from urllib.parse import urlparse
    candidate_domain = urlparse(candidate_url).hostname or candidate_url.replace("https://", "").replace("http://", "").split("/")[0]

    try:
        dom_mod = _get_dom_extractor()
        dom_fingerprint = dom_mod.extract_dom_fingerprint(html)
        print(f"[AIService] DOM: {dom_fingerprint.get('element_count', 0)} elements, "
              f"{dom_fingerprint.get('form_count', 0)} forms")
    except Exception as e:
        print(f"[AIService] DOM extraction error: {e}")
        traceback.print_exc()
        dom_fingerprint = {
            "element_count": 0, "tag_frequency": {}, "dom_depth": 0,
            "form_count": 0, "input_count": 0, "has_nav": False,
            "has_header": False, "has_footer": False, "link_count": 0,
            "script_count": 0, "meta_tags": [],
        }

    try:
        form_mod = _get_form_extractor()
        form_fingerprint = form_mod.extract_forms(html, candidate_url)
        print(f"[AIService] Forms: {form_fingerprint.get('form_count', 0)}, "
              f"external_action={form_fingerprint.get('has_external_action', False)}, "
              f"password={form_fingerprint.get('has_password_field', False)}")
    except Exception as e:
        print(f"[AIService] Form extraction error: {e}")
        traceback.print_exc()
        form_fingerprint = {
            "form_count": 0, "forms": [], "has_password_field": False,
            "has_external_action": False, "external_action_domains": [],
        }

    candidate_evidence = {
        "candidate_url": candidate_url,
        "domain": candidate_domain,
        "title": "",
        "screenshot_path": None,
        "logo_path": None,
        "visual_embedding": None,   # → visual similarity defaults to neutral
        "logo_embedding": None,     # → logo similarity defaults to neutral
        "dom_fingerprint": dom_fingerprint,
        "form_fingerprint": form_fingerprint,
        "css_colors": [],           # → css similarity defaults to neutral
    }

    return _evaluate_candidate_evidence(candidate_evidence, twin_domain=twin_domain, analysis_type="HTML")


# ── URL-based analysis (uses Playwright) ──────────────────────
async def run_ai_analysis(
    candidate_url: str,
    twin_domain: str = "ycce.edu",
) -> dict[str, Any]:
    """
    Run full AI analysis by fetching and rendering the URL via Playwright (async).
    Requires evidence-engine/pipeline.py (browser + CLIP).

    Falls back to run_ai_analysis_from_html() with empty HTML on render
    failure (e.g. network unreachable) so the URL-intelligence and
    no-twin checks still run correctly.
    """
    candidate_url = (candidate_url or "").strip()
    if candidate_url and not candidate_url.startswith(("http://", "https://")):
        candidate_url = f"https://{candidate_url}"

    print(f"\n[AIService] URL-based analysis (Playwright): {candidate_url}")

    try:
        evidence_pipeline = _get_evidence_pipeline()
        evidence = await evidence_pipeline.extract_evidence(candidate_url)
        return _evaluate_candidate_evidence(evidence, twin_domain=twin_domain, analysis_type="Playwright")

    except Exception as e:
        print(f"[AIService] Playwright pipeline failed: {e}")
        traceback.print_exc()
        print("[AIService] Falling back to HTML-based analysis with empty HTML.")
        return run_ai_analysis_from_html(
            candidate_url=candidate_url,
            html="<html><body></body></html>",
            twin_domain=twin_domain,
        )


# ── Twin fingerprint generation ───────────────────────────────
async def generate_twin_fingerprint(url: str, name: str) -> dict[str, Any]:
    try:
        fp_mod = _get_fingerprint()
        return await fp_mod.generate_fingerprint(url=url, website_name=name)
    except Exception as e:
        print(f"[AIService] Fingerprint generation error: {e}")
        traceback.print_exc()
        domain = url.split("//")[-1].split("/")[0]
        return {
            "website_name": name,
            "official_url": url,
            "domain": domain,
            "fingerprint_version": 1,
            "screenshot_path": None,
            "created_at": None,
            "error": str(e),
        }


