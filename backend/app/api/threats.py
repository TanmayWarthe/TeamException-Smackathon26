from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database.session import get_db
from ..models.entities import Threat
from ..schemas.schemas import ThreatListItem, ThreatDetailResponse, UpdateThreatStatusRequest

from ..websocket.manager import ws_manager

router = APIRouter(prefix="/threats", tags=["threats"])

@router.get("", response_model=list[ThreatListItem])
async def list_threats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Threat).order_by(Threat.detected_at.desc()))
    threats = result.scalars().all()
    
    return [
        ThreatListItem(
            id=t.id,
            url=t.url,
            domain=t.domain,
            targeted_portal=t.targeted_portal,
            risk_score=t.risk_score,
            confidence=t.confidence,
            threat_status=t.threat_status,
            detected_at=t.detected_at.isoformat() if t.detected_at else "2026-08-02T09:18:00Z",
            screenshot_path=t.screenshot_path or "/mock/screenshots/threat_001.png"
        )
        for t in threats
    ]

@router.get("/{id}", response_model=ThreatDetailResponse)
async def get_threat_detail(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Threat).where(Threat.id == id))
    t = result.scalar_one_or_none()
    
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Threat not found")
        
    return ThreatDetailResponse(
        id=t.id,
        url=t.url,
        domain=t.domain,
        ip_address=t.ip_address or "185.220.101.4",
        registrar=t.registrar or "NameCheap Inc.",
        ssl_status=t.ssl_status or "Valid (Recently Issued)",
        risk_score=t.risk_score,
        confidence=t.confidence,
        threat_status=t.threat_status,
        targeted_portal=t.targeted_portal,
        detected_at=t.detected_at.isoformat() if t.detected_at else "2026-08-02T09:18:00Z",
        screenshot_path=t.screenshot_path or "/mock/screenshots/threat_001.png",
        official_screenshot_path=t.official_screenshot_path or "/mock/screenshots/official_erp.png",
        similarity_report=t.similarity_report or {
            "visual_similarity": 97.4,
            "dom_similarity": 95.8,
            "css_similarity": 94.1,
            "logo_similarity": 100,
            "form_similarity": 99.0,
            "ssl_similarity": 70.0,
            "javascript_similarity": 92.3,
            "url_similarity": 18.0,
            "overall_similarity": 91.2,
        },
        risk_breakdown=t.risk_breakdown or [
            {"feature": "Visual Similarity", "score": 98, "weight": 25, "contribution": 24.5},
            {"feature": "DOM Similarity", "score": 96, "weight": 20, "contribution": 19.2},
            {"feature": "Form Similarity", "score": 97, "weight": 20, "contribution": 19.4},
            {"feature": "JavaScript Behaviour", "score": 92, "weight": 15, "contribution": 13.8},
            {"feature": "Logo Similarity", "score": 100, "weight": 10, "contribution": 10.0},
            {"feature": "URL Intelligence", "score": 18, "weight": 5, "contribution": 0.9},
            {"feature": "SSL Trust", "score": 70, "weight": 5, "contribution": 3.5},
        ],
        explanation=t.explanation or {
            "risk_score": t.risk_score,
            "reasons": [
                "Copied Institutional Logo",
                "Highly Similar DOM Structure",
                "Credential Submission Redirected to Unknown Server",
                "Suspicious Domain (Recently Registered)",
            ],
            "recommendation": "Do Not Enter Credentials",
        },
        evidence=t.evidence or {
            "html_path": f"/mock/evidence/{t.id}.html",
            "dom_path": f"/mock/evidence/{t.id}_dom.json",
            "css_path": f"/mock/evidence/{t.id}.css",
            "javascript_path": f"/mock/evidence/{t.id}.js",
        },
        timeline=t.timeline or [
            {"time": "09:15 AM", "label": "New Domain Detected"},
            {"time": "09:16 AM", "label": "Website Crawled"},
            {"time": "09:17 AM", "label": "Similarity Analysis Completed"},
            {"time": "09:18 AM", "label": f"Risk Score: {t.risk_score}%"},
            {"time": "09:18 AM", "label": "Administrator Alert Generated"},
        ],
        admin_notes=t.admin_notes or "",
    )

@router.post("/{id}/status")
async def update_threat_status(id: str, req: UpdateThreatStatusRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Threat).where(Threat.id == id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Threat not found")
        
    t.threat_status = req.status
    if req.notes is not None:
        t.admin_notes = req.notes
        
    await db.commit()

    # Real-time WebSocket broadcast of status change
    await ws_manager.broadcast_threat_status(id, req.status, req.notes)

    return {"message": "Threat status updated successfully", "id": id, "status": req.status}
