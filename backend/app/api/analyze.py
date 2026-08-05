from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from urllib.parse import urlparse
from datetime import datetime, timezone

from ..database.session import get_db
from ..models.entities import Threat, Notification
from ..schemas.schemas import CandidateAnalyzeRequest, AnalysisResponse
from ..services.ai_service import run_ai_analysis_from_html, run_ai_analysis

router = APIRouter(tags=["analyze"])

# Threat persistence threshold:
# Only sites that score >= MIN_THREAT_PERSIST_SCORE (i.e. SUSPICIOUS [50-70], HIGH_RISK [71-90], CRITICAL [91-100])
# are persisted to the threats table. Safe / Trusted / Low-risk pages (< 50) and UNKNOWN
# results are evaluated in real time for extension protection but do NOT pollute the threats DB.
MIN_THREAT_PERSIST_SCORE = 50


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_candidate(req: CandidateAnalyzeRequest, db: AsyncSession = Depends(get_db)):
    """
    Core API endpoint consumed by the Chrome Extension & Admin URL Inspector.
    Runs the full AI/ML Similarity & Risk Scoring engine against institutional digital twins.

    Accepts HTML directly (preferred) to skip browser rendering:
        - `html`: raw HTML string of the page to analyze
        - `domSnapshot` / `dom_snapshot`: alias for HTML (Chrome extension compatibility)

    If no HTML is provided, falls back to fetching the URL via Playwright.
    """
    candidate_url = req.url
    domain = req.domain or urlparse(candidate_url).hostname or candidate_url

    # Resolve submitted HTML — prefer explicit `html`, fall back to `domSnapshot`/`dom_snapshot`
    submitted_html = req.html or req.domSnapshot or req.dom_snapshot

    # ── Run the real AI pipeline ──────────────────────────────
    if submitted_html:
        # Primary path: HTML submitted directly → no Playwright needed
        result = run_ai_analysis_from_html(
            candidate_url=candidate_url,
            html=submitted_html,
        )
    else:
        # URL path: fetch + render via Playwright (evidence-engine pipeline)
        result = await run_ai_analysis(candidate_url=candidate_url)

    risk_score = result.get("risk_score", 0)
    status = result.get("status", "UNKNOWN")
    recommendation = result.get("recommendation", "ALLOW")
    reasons = result.get("reasons", [])
    confidence = result.get("confidence", 0)

    # ── Persist to active threats DB (only genuine risk results) ─
    # UNKNOWN results (no twin registered) and safe/low-risk pages (< 50) are NOT persisted as threats.
    is_unknown = result.get("details", {}).get("no_twin", False) or status == "UNKNOWN"

    if not is_unknown and risk_score >= MIN_THREAT_PERSIST_SCORE:
        fused_scores = result.get("details", {}).get("fused_scores", {})

        risk_breakdown = []
        for feature, weight, key in [
            ("Visual Similarity", 25, "visual"),
            ("DOM Similarity",    20, "dom"),
            ("Form Similarity",   20, "form"),
            ("JavaScript Behaviour", 15, "javascript"),
            ("Logo Similarity",   10, "logo"),
            ("URL Intelligence",   5, "url"),
            ("SSL Trust",          5, "ssl"),
        ]:
            score = fused_scores.get(key, 50)
            risk_breakdown.append({
                "feature": feature,
                "score": round(float(score), 1),
                "weight": weight,
                "contribution": round(float(score) * weight / 100, 1),
            })

        now_utc = datetime.now(timezone.utc)

        # Upsert: check for existing ACTIVE threat for this domain
        existing_res = await db.execute(
            select(Threat).where(
                Threat.domain == domain,
                Threat.threat_status == "ACTIVE"
            ).order_by(Threat.detected_at.desc())
        )
        existing_threat = existing_res.scalars().first()

        if existing_threat:
            # Update existing active threat row in-place
            existing_threat.url = candidate_url
            existing_threat.risk_score = int(risk_score)
            existing_threat.confidence = int(confidence)
            existing_threat.recommendation = recommendation
            existing_threat.detected_at = now_utc
            existing_threat.similarity_report = fused_scores
            existing_threat.risk_breakdown = risk_breakdown
            existing_threat.explanation = {
                "risk_score": int(risk_score),
                "reasons": reasons,
                "recommendation": recommendation,
            }
            existing_threat.evidence = {
                "html_path": f"/storage/evidence/{domain}.html",
                "dom_path": f"/storage/evidence/{domain}_dom.json",
            }
            new_timeline_entry = {
                "time": now_utc.strftime("%I:%M %p"),
                "label": f"Re-analyzed: Risk Score {int(risk_score)}%"
            }
            existing_threat.timeline = (existing_threat.timeline or []) + [new_timeline_entry]
        else:
            # Insert brand new threat row
            new_threat = Threat(
                url=candidate_url,
                domain=domain,
                targeted_portal="ERP",
                risk_score=int(risk_score),
                confidence=int(confidence),
                threat_status="ACTIVE",
                recommendation=recommendation,
                screenshot_path=None,
                official_screenshot_path=None,
                similarity_report=fused_scores,
                risk_breakdown=risk_breakdown,
                explanation={
                    "risk_score": int(risk_score),
                    "reasons": reasons,
                    "recommendation": recommendation,
                },
                evidence={
                    "html_path": f"/storage/evidence/{domain}.html",
                    "dom_path": f"/storage/evidence/{domain}_dom.json",
                },
                timeline=[
                    {"time": now_utc.strftime("%I:%M %p"), "label": "Domain Analyzed"},
                    {"time": now_utc.strftime("%I:%M %p"), "label": f"Risk Score: {int(risk_score)}%"},
                ],
            )
            db.add(new_threat)
            await db.flush()

            notif_severity = "Critical" if risk_score >= 90 else ("High Risk" if risk_score >= 70 else "Suspicious")
            notif = Notification(
                title=f"{notif_severity} Threat Detected",
                message=f"{domain} scored {int(risk_score)}% risk. Immediate review recommended.",
                read_status=False,
                threat_id=new_threat.id,
            )
            db.add(notif)

        await db.commit()

    return AnalysisResponse(
        status=status,
        risk_score=int(risk_score),
        confidence=int(confidence),
        recommendation=recommendation,
        reasons=reasons,
    )
