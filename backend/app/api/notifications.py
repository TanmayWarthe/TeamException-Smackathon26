from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database.session import get_db
from ..models.entities import Notification
from ..schemas.schemas import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("", response_model=list[NotificationResponse])
async def list_notifications(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).order_by(Notification.created_at.desc()))
    notifs = result.scalars().all()
    
    return [
        NotificationResponse(
            id=n.id,
            title=n.title,
            message=n.message,
            read_status=n.read_status,
            created_at=n.created_at.isoformat() if n.created_at else "2026-08-02T09:18:30Z",
            threat_id=n.threat_id
        )
        for n in notifs
    ]

@router.patch("/{id}/read")
async def mark_notification_read(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.id == id))
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
        
    n.read_status = True
    await db.commit()
    return {"message": "Notification marked as read", "id": id}
