from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database.session import get_db
from ..models.entities import ProtectionEvent
from ..schemas.schemas import ProtectionEventCreate
from ..websocket.manager import ws_manager

router = APIRouter(prefix="/events", tags=["events"])

@router.get("")
async def get_event_statistics(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProtectionEvent))
    events = result.scalars().all()
    
    warn = sum(1 for e in events if e.event_type == "WARNING_DISPLAYED")
    blocked = sum(1 for e in events if e.event_type == "LOGIN_BLOCKED")
    allowed = sum(1 for e in events if e.event_type == "LOGIN_ALLOWED")
    ignored = sum(1 for e in events if e.event_type == "THREAT_IGNORED")

    browser_counts = {}
    for e in events:
        b = e.browser or "Chrome"
        browser_counts[b] = browser_counts.get(b, 0) + 1

    by_browser = [
        {"browser": b, "count": c}
        for b, c in sorted(browser_counts.items(), key=lambda x: x[1], reverse=True)
    ]
    
    return {
        "warning_displayed": warn,
        "login_blocked": blocked,
        "login_allowed": allowed,
        "threat_ignored": ignored,
        "by_browser": by_browser
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

    await ws_manager.broadcast_telemetry_event({
        "id": pe.id,
        "event_type": pe.event_type,
        "domain": pe.domain,
        "browser": pe.browser,
        "details": pe.details,
        "created_at": pe.timestamp.isoformat() if hasattr(pe, "timestamp") and pe.timestamp else None,
    })

    return {"status": "success", "id": pe.id}
