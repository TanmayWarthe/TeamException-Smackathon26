# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select
from urllib.parse import urlparse
from datetime import datetime, timezone

from ..database.session import get_db
from ..models.entities import Threat, Notification, DigitalTwinModel
from ..schemas.schemas import CandidateAnalyzeRequest, AnalysisResponse
from ..services.ai_service import run_ai_analysis_from_html, run_ai_analysis
from ..services.infra_service import resolve_domain_infrastructure
from ..websocket.manager import ws_manager

router = APIRouter(tags=["analyze"])

# Threat persistence threshold:
# Only sites that score >= MIN_THREAT_PERSIST_SCORE (i.e. SUSPICIOUS [50-70], HIGH_RISK [71-90], CRITICAL [91-100])
# are persisted to the threats table. Safe / Trusted / Low-risk pages (< 50) and UNKNOWN
# results are evaluated in real time for extension protection but do NOT pollute the threats DB.
MIN_THREAT_PERSIST_SCORE = 50


def _get_risk_level(score: int) -> str:
    if score <= 25:
        return "TRUSTED"
    if score <= 50:
        return "LOW"
    if score <= 70:
        return "SUSPICIOUS"
    if score <= 90:
        return "HIGH"
    return "CRITICAL"


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
    candidate_url = (req.url or "").strip()
    if candidate_url and not candidate_url.startswith(("http://", "https://")):
        candidate_url = f"https://{candidate_url}"
    domain = req.domain or urlparse(candidate_url).hostname or candidate_url.replace("https://", "").replace("http://", "").split("/")[0]

    # Resolve submitted HTML — prefer explicit `html`, fall back to `domSnapshot`/`dom_snapshot`
    submitted_html = req.html or req.domSnapshot or req.dom_snapshot
    target_twin = (req.twin_domain or req.target_twin or "").strip() or None

    # ── Run the real AI pipeline ──────────────────────────────
    if submitted_html:
        # Primary path: HTML submitted directly → no Playwright needed
        result = run_ai_analysis_from_html(
            candidate_url=candidate_url,
            html=submitted_html,
            twin_domain=target_twin,
        )
    else:
        # URL path: fetch + render via Playwright (evidence-engine pipeline)
        result = await run_ai_analysis(
            candidate_url=candidate_url,
            twin_domain=target_twin,
        )

    risk_score = int(result.get("risk_score", 0))
    status = result.get("status", "UNKNOWN")
    recommendation = result.get("recommendation", "ALLOW")
    reasons = result.get("reasons", [])
    confidence = int(result.get("confidence", 0))
    risk_level = _get_risk_level(risk_score)

    details = result.get("details", {})
    fused_scores = details.get("fused_scores", {})
    twin_domain = details.get("twin_domain")
    is_unknown = details.get("no_twin", False) or status == "UNKNOWN" or not twin_domain

    # Build risk breakdown for rich explanation
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
        score = fused_scores.get(key, 50.0 if status != "TRUSTED" else 0.0)
        risk_breakdown.append({
            "feature": feature,
            "score": round(float(score), 1),
            "weight": weight,
            "contribution": round(float(score) * weight / 100, 1),
        })

    # Look up digital twin from DB for accurate portal metadata
    matched_twin = None
    if twin_domain and not is_unknown:
        clean_target = twin_domain.replace("www.", "").strip().lower()
        twin_db_res = await db.execute(
            select(DigitalTwinModel).where(
                (DigitalTwinModel.domain == twin_domain) |
                (DigitalTwinModel.domain == clean_target) |
                (DigitalTwinModel.domain == f"www.{clean_target}") |
                (DigitalTwinModel.official_url.like(f"%{clean_target}%")) |
                (DigitalTwinModel.website_name.ilike(f"%{clean_target}%"))
            )
        )
        twin_record = twin_db_res.scalars().first()
        portal_name = twin_record.website_name if twin_record else (
            f"{clean_target.capitalize()} Portal"
        )
        official_screenshot = twin_record.screenshot_path if twin_record else ""

        matched_twin = {
            "website_name": portal_name,
            "domain": twin_record.domain if twin_record else twin_domain,
            "official_url": twin_record.official_url if twin_record else (f"https://{twin_domain}" if not twin_domain.startswith("http") else twin_domain),
        }

    # ── Persist to active threats DB (only genuine risk results) ─
    persisted_threat_id = None
    now_utc = datetime.now(timezone.utc)

    if not is_unknown and risk_score >= MIN_THREAT_PERSIST_SCORE and twin_domain:
        infra = resolve_domain_infrastructure(candidate_url, domain)

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
            existing_threat.targeted_portal = portal_name
            existing_threat.risk_score = risk_score
            existing_threat.confidence = confidence
            existing_threat.recommendation = recommendation
            existing_threat.detected_at = now_utc
            existing_threat.similarity_report = fused_scores
            existing_threat.risk_breakdown = risk_breakdown
            existing_threat.ip_address = infra["ip_address"]
            existing_threat.registrar = infra["registrar"]
            existing_threat.ssl_status = infra["ssl_status"]
            if official_screenshot:
                existing_threat.official_screenshot_path = official_screenshot
            existing_threat.explanation = {
                "risk_score": risk_score,
                "reasons": reasons,
                "recommendation": recommendation,
            }
            existing_threat.evidence = {
                "html_path": f"/storage/evidence/{domain}.html",
                "dom_path": f"/storage/evidence/{domain}_dom.json",
            }
            new_timeline_entry = {
                "time": now_utc.strftime("%I:%M %p"),
                "label": f"Re-analyzed: Risk Score {risk_score}%"
            }
            existing_threat.timeline = (existing_threat.timeline or []) + [new_timeline_entry]
            persisted_threat_id = existing_threat.id

            await db.commit()

            # Real-time WebSocket Broadcast: Threat Updated
            await ws_manager.broadcast_threat_detected({
                "id": existing_threat.id,
                "url": candidate_url,
                "domain": domain,
                "targeted_portal": existing_threat.targeted_portal,
                "risk_score": risk_score,
                "confidence": confidence,
                "threat_status": "ACTIVE",
                "recommendation": recommendation,
                "detected_at": now_utc.isoformat(),
                "screenshot_path": existing_threat.screenshot_path or "",
                "ip_address": infra["ip_address"],
                "registrar": infra["registrar"],
                "ssl_status": infra["ssl_status"],
                "reasons": reasons,
                "is_update": True,
            })
        else:
            # Insert brand new threat row
            new_threat = Threat(
                url=candidate_url,
                domain=domain,
                targeted_portal=portal_name,
                risk_score=risk_score,
                confidence=confidence,
                threat_status="ACTIVE",
                recommendation=recommendation,
                screenshot_path=None,
                official_screenshot_path=official_screenshot,
                ip_address=infra["ip_address"],
                registrar=infra["registrar"],
                ssl_status=infra["ssl_status"],
                similarity_report=fused_scores,
                risk_breakdown=risk_breakdown,
                explanation={
                    "risk_score": risk_score,
                    "reasons": reasons,
                    "recommendation": recommendation,
                },
                evidence={
                    "html_path": f"/storage/evidence/{domain}.html",
                    "dom_path": f"/storage/evidence/{domain}_dom.json",
                },
                timeline=[
                    {"time": now_utc.strftime("%I:%M %p"), "label": "Domain Analyzed"},
                    {"time": now_utc.strftime("%I:%M %p"), "label": f"Risk Score: {risk_score}%"},
                ],
            )
            db.add(new_threat)
            await db.flush()

            notif_severity = "Critical" if risk_score >= 90 else ("High Risk" if risk_score >= 70 else "Suspicious")
            notif = Notification(
                title=f"{notif_severity} Threat Detected",
                message=f"{domain} scored {risk_score}% risk targeting {portal_name}. Immediate review recommended.",
                read_status=False,
                threat_id=new_threat.id,
            )
            db.add(notif)
            persisted_threat_id = new_threat.id

            await db.commit()

            # Real-time WebSocket Broadcast: New Threat Detected
            await ws_manager.broadcast_threat_detected({
                "id": new_threat.id,
                "url": candidate_url,
                "domain": domain,
                "targeted_portal": portal_name,
                "risk_score": risk_score,
                "confidence": confidence,
                "threat_status": "ACTIVE",
                "recommendation": recommendation,
                "detected_at": now_utc.isoformat(),
                "screenshot_path": "",
                "reasons": reasons,
                "is_update": False,
            })

            # Real-time WebSocket Broadcast: Notification
            await ws_manager.broadcast_notification({
                "id": notif.id,
                "title": notif.title,
                "message": notif.message,
                "read_status": False,
                "created_at": now_utc.isoformat(),
                "threat_id": new_threat.id,
            })

    return AnalysisResponse(
        status=status,
        risk_score=risk_score,
        confidence=confidence,
        recommendation=recommendation,
        reasons=reasons,
        risk_level=risk_level,
        risk_breakdown=risk_breakdown,
        similarity_report=fused_scores,
        matched_twin=matched_twin,
        threat_id=persisted_threat_id,
        domain=domain,
        url=candidate_url,
        analyzed_at=now_utc.isoformat(),
    )
