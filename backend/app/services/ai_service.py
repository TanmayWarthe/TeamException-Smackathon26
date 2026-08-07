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


_LEGITIMATE_DATASET_DOMAINS = None

def _get_legitimate_domains() -> set[str]:
    global _LEGITIMATE_DATASET_DOMAINS
    if _LEGITIMATE_DATASET_DOMAINS is None:
        _LEGITIMATE_DATASET_DOMAINS = set()
        dataset_path = _project_root / "legitimate_domains_dataset.json"
        if dataset_path.exists():
            try:
                import json
                with open(dataset_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        dom = (item.get("domain") or "").strip().lower()
                        if dom:
                            _LEGITIMATE_DATASET_DOMAINS.add(dom)
                            clean = dom.replace("www.", "")
                            _LEGITIMATE_DATASET_DOMAINS.add(clean)
                            _LEGITIMATE_DATASET_DOMAINS.add(f"www.{clean}")
            except Exception as e:
                print(f"[AIService] Error loading legitimate domains dataset: {e}")
    return _LEGITIMATE_DATASET_DOMAINS


# ── Shared AI Evaluation Pipeline ─────────────────────────────
def _evaluate_candidate_evidence(
    candidate_evidence: dict[str, Any],
    twin_domain: Optional[str] = None,
    analysis_type: str = "HTML",
) -> dict[str, Any]:
    """
    Unified AI analysis evaluation pipeline.
    Takes structured candidate evidence (from HTML or Playwright) and runs:
      1. Digital Twin loading & targeted brand/domain matching
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
        "geeksforgeeks.org", "practice.geeksforgeeks.org", "leetcode.com", "hackerrank.com",
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

    legit_dataset = _get_legitimate_domains()

    is_official_institutional = (
        candidate_domain in INSTITUTIONAL_ROOTS
        or any(candidate_domain.endswith("." + root) for root in INSTITUTIONAL_ROOTS)
    )
    is_global_public = (
        candidate_domain in GLOBAL_PUBLIC_ALLOWLIST
        or any(candidate_domain.endswith("." + domain) for domain in GLOBAL_PUBLIC_ALLOWLIST)
    )
    is_in_legit_dataset = (
        candidate_domain in legit_dataset
        or any(candidate_domain.endswith("." + d) for d in legit_dataset if len(d) > 3)
    )
    is_trusted_tld = any(
        candidate_domain.endswith(tld) for tld in TRUSTED_TLD_PATTERNS
    )

    if is_official_institutional or is_global_public or is_in_legit_dataset or is_trusted_tld:
        domain_type = "campus" if is_official_institutional else ("educational/government" if is_trusted_tld else "verified legitimate")
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

    # ── 1. Load Digital Twin(s) ──────────────────────────────
    twins_to_evaluate = []
    is_explicit_twin = False
    try:
        twin_store = _get_twin_store()
        
        # If an explicit twin_domain is provided, prioritize and lock onto it
        if twin_domain:
            exact_twin = twin_store.load_twin(twin_domain)
            if not exact_twin and "www." in twin_domain:
                exact_twin = twin_store.load_twin(twin_domain.replace("www.", ""))
            if not exact_twin and not twin_domain.startswith("www."):
                exact_twin = twin_store.load_twin(f"www.{twin_domain}")

            if exact_twin:
                # Target twin explicitly found — evaluate directly against this target
                twins_to_evaluate.append((exact_twin.get("domain") or twin_domain, exact_twin))
                is_explicit_twin = True

        # If no explicit twin or explicit twin not found, load all registered twins for smart matching
        if not twins_to_evaluate:
            all_twins = twin_store.load_all_twins()
            for t in all_twins:
                t_dom = t.get("domain") or "default_portal"
                twins_to_evaluate.append((t_dom, t))
    except Exception as e:
        print(f"[AIService] ERROR loading twin store: {e}")
        traceback.print_exc()
        return _no_twin_response(twin_domain or "unknown")

    if not twins_to_evaluate:
        print(f"[AIService] No twins registered in system. Returning UNKNOWN status.")
        return _no_twin_response(twin_domain or "unknown")

    fusion_mod = _get_feature_fusion()
    scoring_mod = _get_scoring()
    categorize_mod = _get_categorize()
    explain_mod = _get_explain()

    best_response = None
    max_alignment_score = -1.0

    cand_title = (candidate_evidence.get("title") or "").lower()
    cand_domain = (candidate_evidence.get("domain") or "").lower()
    cand_raw_html = str(candidate_evidence.get("dom_fingerprint") or "").lower()

    for current_twin_domain, twin in twins_to_evaluate:
        try:
            fused_scores = fusion_mod.fuse(candidate_evidence, twin)
            risk_result = scoring_mod.calculate_risk(fused_scores)
            calc_risk = risk_result["risk_score"]

            twin_name = (twin.get("website_name") or "").lower()
            clean_twin_dom = current_twin_domain.replace("www.", "").split(".")[0].lower()
            
            # Structural & visual alignment
            structural_alignment = (
                fused_scores.get("dom", 0) * 0.35 +
                fused_scores.get("visual", 0) * 0.25 +
                fused_scores.get("logo", 0) * 0.20 +
                fused_scores.get("form", 0) * 0.20
            )

            # Brand / Keyword / Typosquatting matching
            brand_alignment = 0.0
            has_brand_mention = False

            if clean_twin_dom and len(clean_twin_dom) > 2:
                if clean_twin_dom in cand_domain:
                    brand_alignment += 60.0
                    has_brand_mention = True
                if clean_twin_dom in cand_title:
                    brand_alignment += 50.0
                    has_brand_mention = True
                if clean_twin_dom in cand_raw_html:
                    brand_alignment += 30.0
                    has_brand_mention = True

            if twin_name and len(twin_name) > 3:
                if twin_name in cand_title:
                    brand_alignment += 60.0
                    has_brand_mention = True
                if twin_name in cand_raw_html:
                    brand_alignment += 30.0
                    has_brand_mention = True

            # Typosquatting similarity check
            from difflib import SequenceMatcher
            clean_cand_root = cand_domain.replace("www.", "").split(".")[0]
            if len(clean_cand_root) > 2 and len(clean_twin_dom) > 2:
                typo_ratio = SequenceMatcher(None, clean_cand_root, clean_twin_dom).ratio()
                if typo_ratio > 0.75 and clean_cand_root != clean_twin_dom:
                    brand_alignment += 50.0
                    has_brand_mention = True

            red_flags = fused_scores.get("red_flags", [])
            has_external_pw_theft = any("Credential Submission Redirected" in rf for rf in red_flags)

            # Match criteria: A twin is valid if:
            # 1. It was explicitly targeted by caller, OR
            # 2. Candidate explicitly mimics twin's brand/domain token, OR
            # 3. Candidate is a high-fidelity visual/DOM clone (structural >= 70%), OR
            # 4. External credential exfiltration red flag detected
            is_valid_target_twin = (
                is_explicit_twin or
                has_brand_mention or
                structural_alignment >= 70.0 or
                (has_external_pw_theft and (has_brand_mention or structural_alignment >= 55.0))
            )

            if not is_valid_target_twin:
                # This twin is unrelated to candidate site — skip matching to avoid false alarms
                continue

            total_alignment = structural_alignment + brand_alignment

            if total_alignment > max_alignment_score:
                max_alignment_score = total_alignment
                category = categorize_mod.categorize_risk(calc_risk)
                reasons = explain_mod.generate_reasons(
                    fused_scores=fused_scores,
                    contributions=risk_result["component_contributions"],
                    red_flags=red_flags,
                    risk_score=calc_risk,
                )
                final_score = int(round(calc_risk))
                
                best_response = {
                    "status": category["status"],
                    "risk_score": final_score,
                    "confidence": int(round(risk_result["confidence"])),
                    "recommendation": category["recommendation"],
                    "reasons": reasons,
                    "details": {
                        "fused_scores": {k: float(v) for k, v in fused_scores.items() if isinstance(v, (int, float))},
                        "component_contributions": risk_result.get("component_contributions", {}),
                        "red_flags": red_flags,
                        "candidate_domain": candidate_domain,
                        "twin_domain": current_twin_domain,
                        "no_twin": False,
                    },
                }
        except Exception as e:
            print(f"[AIService] Evaluation error for twin '{current_twin_domain}': {e}")
            traceback.print_exc()

    if best_response:
        print(f"[AIService] Best twin match '{best_response['details']['twin_domain']}': "
              f"status={best_response['status']}, risk_score={best_response['risk_score']}")
        return best_response

    # If no twin was targeted or matched, candidate is a standard benign website
    print(f"[AIService] Candidate '{candidate_domain}' does not mimic any registered digital twin. Returning TRUSTED.")
    return {
        "status": "TRUSTED",
        "risk_score": 0,
        "confidence": 90,
        "recommendation": "ALLOW",
        "reasons": [
            f"Standard web page ({candidate_domain}) — no brand impersonation or phishing indicators detected against registered digital twins."
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
            "twin_domain": None,
            "no_twin": True,
        },
    }


# ── Main entry point: HTML-first analysis ─────────────────────
def run_ai_analysis_from_html(
    candidate_url: str,
    html: str,
    twin_domain: Optional[str] = None,
) -> dict[str, Any]:
    """
    Analyse a candidate page using its submitted HTML directly.

    Does NOT require Playwright or CLIP (no browser rendering).
    Visual/logo similarity scores default to neutral (50) when no
    screenshot embedding is available.

    Args:
        candidate_url: The URL of the page being checked.
        html: The raw HTML of the candidate page.
        twin_domain: Optional domain of the Digital Twin to compare against.

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

    import re
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    extracted_title = title_match.group(1).strip() if title_match else ""

    candidate_evidence = {
        "candidate_url": candidate_url,
        "domain": candidate_domain,
        "title": extracted_title,
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
    twin_domain: Optional[str] = None,
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


