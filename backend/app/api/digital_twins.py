from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from urllib.parse import urlparse

from ..database.session import get_db
from ..models.entities import DigitalTwinModel
from ..schemas.schemas import DigitalTwinResponse, CreateDigitalTwinRequest
from ..services.ai_service import generate_twin_fingerprint

router = APIRouter(prefix="/digital-twins", tags=["digital-twins"])

from datetime import datetime, timezone

@router.get("", response_model=list[DigitalTwinResponse])
async def list_digital_twins(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DigitalTwinModel).order_by(DigitalTwinModel.created_at.desc()))
    twins = result.scalars().all()
    
    return [
        DigitalTwinResponse(
            id=t.id,
            website_name=t.website_name,
            official_url=t.official_url,
            fingerprint_version=t.fingerprint_version,
            screenshot_path=t.screenshot_path or "/mock/screenshots/official_erp.png",
            created_at=t.created_at.isoformat() if t.created_at else "2026-05-10T10:00:00Z",
            updated_at=t.updated_at.isoformat() if t.updated_at else "2026-07-15T10:00:00Z",
        )
        for t in twins
    ]

@router.post("", response_model=DigitalTwinResponse)
async def create_digital_twin(req: CreateDigitalTwinRequest, db: AsyncSession = Depends(get_db)):
    domain = urlparse(req.official_url).hostname or req.official_url
    
    # Trigger fingerprint generation (async)
    fp = await generate_twin_fingerprint(req.official_url, req.website_name)
    if fp.get("error"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to generate digital twin fingerprint: {fp.get('error')}"
        )
    
    try:
        # Check if twin already exists to prevent UNIQUE constraint violation
        existing = await db.execute(
            select(DigitalTwinModel).where(DigitalTwinModel.official_url == req.official_url)
        )
        twin = existing.scalars().first()
        
        now = datetime.now(timezone.utc)
        if twin:
            twin.website_name = req.website_name
            twin.domain = domain
            twin.fingerprint_version = fp.get("fingerprint_version", 1)
            twin.screenshot_path = fp.get("screenshot_path", "")
            twin.updated_at = now
        else:
            twin = DigitalTwinModel(
                website_name=req.website_name,
                official_url=req.official_url,
                domain=domain,
                fingerprint_version=fp.get("fingerprint_version", 1),
                screenshot_path=fp.get("screenshot_path", ""),
                created_at=now,
                updated_at=now,
            )
            db.add(twin)
            
        await db.commit()
        await db.refresh(twin)
        
        return DigitalTwinResponse(
            id=twin.id,
            website_name=twin.website_name,
            official_url=twin.official_url,
            fingerprint_version=twin.fingerprint_version,
            screenshot_path=twin.screenshot_path or "/mock/screenshots/official_erp.png",
            created_at=twin.created_at.isoformat() if twin.created_at else now.isoformat(),
            updated_at=twin.updated_at.isoformat() if twin.updated_at else now.isoformat(),
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save digital twin to database: {str(e)}"
        )

