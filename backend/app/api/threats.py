from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from ..database.session import get_db
from ..models.entities import Threat, DigitalTwinModel
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

    # Look up matched digital twin dynamically from DB
    target_clean = (t.targeted_portal or "").strip()
    target_lower = target_clean.lower()
    
    twin = None
    if target_clean:
        twin_result = await db.execute(
            select(DigitalTwinModel).where(
                (DigitalTwinModel.website_name == target_clean) |
                (DigitalTwinModel.website_name.ilike(f"%{target_clean}%")) |
                (DigitalTwinModel.domain == target_clean) |
                (DigitalTwinModel.domain.ilike(f"%{target_clean}%")) |
                (DigitalTwinModel.official_url.ilike(f"%{target_clean}%"))
            )
        )
        twin = twin_result.scalars().first()

    if not twin:
        # Check by individual keywords (e.g. 'amazon', 'github', 'ycce')
        for keyword in [w for w in target_lower.split() if len(w) > 3]:
            kw_res = await db.execute(
                select(DigitalTwinModel).where(
                    DigitalTwinModel.website_name.ilike(f"%{keyword}%") |
                    DigitalTwinModel.domain.ilike(f"%{keyword}%") |
                    DigitalTwinModel.official_url.ilike(f"%{keyword}%")
                )
            )
            twin = kw_res.scalars().first()
            if twin:
                break

    matched_twin = None
    if twin:
        matched_twin = {
            "website_name": twin.website_name,
            "domain": twin.domain,
            "official_url": twin.official_url,
        }
    elif t.targeted_portal:
        clean_domain = t.targeted_portal if ("." in t.targeted_portal and " " not in t.targeted_portal) else t.domain
        matched_twin = {
            "website_name": t.targeted_portal,
            "domain": clean_domain,
            "official_url": f"https://{clean_domain}" if not clean_domain.startswith("http") else clean_domain,
        }
        
    return ThreatDetailResponse(
        id=t.id,
        url=t.url,
        domain=t.domain,
        ip_address=t.ip_address or "Not available",
        registrar=t.registrar or "Not available",
        ssl_status=t.ssl_status or "No SSL Certificate (HTTP only)",
        risk_score=t.risk_score,
        confidence=t.confidence,
        threat_status=t.threat_status,
        targeted_portal=t.targeted_portal or (twin.website_name if twin else "Official Portal"),
        detected_at=detected_str,
        screenshot_path=t.screenshot_path or "",
        official_screenshot_path=t.official_screenshot_path or (twin.screenshot_path if twin else ""),
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
        matched_twin=matched_twin,
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


@router.delete("/{id}")
async def delete_threat(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Threat).where(Threat.id == id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Threat not found")
        
    await db.delete(t)
    await db.commit()

    await ws_manager.broadcast({
        "type": "THREAT_DELETED",
        "data": {"threat_id": id}
    })

    return {"message": "Threat deleted successfully", "id": id}


@router.delete("")
async def clear_all_threats(db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Threat))
    await db.commit()

    await ws_manager.broadcast({
        "type": "THREATS_CLEARED",
        "data": {}
    })

    return {"message": "All threats cleared successfully"}
