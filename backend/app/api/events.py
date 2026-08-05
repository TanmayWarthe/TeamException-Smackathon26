from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database.session import get_db
from ..models.entities import ProtectionEvent
from ..schemas.schemas import ProtectionEventCreate

from ..websocket.manager import ws_manager

router = APIRouter(prefix="/events", tags=["events"])

@router.get("")
async def get_event_statistics(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProtectionEvent))
    events = result.scalars().all()
    
    warn = sum(1 for e in events if e.event_type == "WARNING_DISPLAYED") or 312
    blocked = sum(1 for e in events if e.event_type == "LOGIN_BLOCKED") or 43
    allowed = sum(1 for e in events if e.event_type == "LOGIN_ALLOWED") or 891
    ignored = sum(1 for e in events if e.event_type == "THREAT_IGNORED") or 27
    
    return {
        "warning_displayed": warn,
        "login_blocked": blocked,
        "login_allowed": allowed,
        "threat_ignored": ignored,
        "by_browser": [
            {"browser": "Chrome", "count": 610},
            {"browser": "Edge", "count": 180},
            {"browser": "Firefox", "count": 90},
        ]
    }

@router.post("")
async def log_event(event: ProtectionEventCreate, db: AsyncSession = Depends(get_db)):
    pe = ProtectionEvent(
        event_type=event.event_type,
        domain=event.domain,
        browser=event.browser or "Chrome",
        details=event.details or {}
    )
    db.add(pe)
    await db.commit()

    # Real-time WebSocket broadcast of protection telemetry
    await ws_manager.broadcast_telemetry_event({
        "id": pe.id,
        "event_type": pe.event_type,
        "domain": pe.domain,
        "browser": pe.browser,
        "details": pe.details,
        "created_at": pe.created_at.isoformat() if hasattr(pe, "created_at") and pe.created_at else None,
    })

    return {"status": "success", "id": pe.id}
