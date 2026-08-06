from datetime import datetime, timezone
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
            detected_at=t.detected_at.isoformat() if t.detected_at else datetime.now(timezone.utc).isoformat(),
            screenshot_path=t.screenshot_path or ""
        )
        for t in threats
    ]

@router.get("/{id}", response_model=ThreatDetailResponse)
async def get_threat_detail(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Threat).where(Threat.id == id))
    t = result.scalar_one_or_none()
    
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Threat not found")

    detected_str = t.detected_at.isoformat() if t.detected_at else datetime.now(timezone.utc).isoformat()
        
    return ThreatDetailResponse(
        id=t.id,
        url=t.url,
        domain=t.domain,
        ip_address=t.ip_address or "Unassigned",
        registrar=t.registrar or "Unknown Registrar",
        ssl_status=t.ssl_status or "Unknown SSL State",
        risk_score=t.risk_score,
        confidence=t.confidence,
        threat_status=t.threat_status,
        targeted_portal=t.targeted_portal,
        detected_at=detected_str,
        screenshot_path=t.screenshot_path or "",
        official_screenshot_path=t.official_screenshot_path or "",
        similarity_report=t.similarity_report or {},
        risk_breakdown=t.risk_breakdown or [],
        explanation=t.explanation or {
            "risk_score": t.risk_score,
            "reasons": [f"Risk Score evaluated at {t.risk_score}%"],
            "recommendation": t.recommendation or "BLOCK"
        },
        evidence=t.evidence or {},
        timeline=t.timeline or [
            {"time": detected_str, "label": f"Threat Detected and Scored ({t.risk_score}%)"}
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

    await ws_manager.broadcast_threat_status(id, req.status, req.notes)

    return {"message": "Threat status updated successfully", "id": id, "status": req.status}
