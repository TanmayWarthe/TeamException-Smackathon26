from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database.session import get_db
from ..models.entities import Threat, DigitalTwinModel, ProtectionEvent

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("")
@router.get("/stats")
async def get_dashboard_overview(db: AsyncSession = Depends(get_db)):
    threats_res = await db.execute(select(Threat))
    threats = threats_res.scalars().all()
    
    total = len(threats)
    critical = sum(1 for t in threats if t.risk_score >= 90)
    high = sum(1 for t in threats if 70 <= t.risk_score < 90)
    suspicious = sum(1 for t in threats if 50 <= t.risk_score < 70)
    low = sum(1 for t in threats if 25 <= t.risk_score < 50)
    trusted = sum(1 for t in threats if t.risk_score < 25)
    
    twins_res = await db.execute(select(func.count(DigitalTwinModel.id)))
    twins_count = twins_res.scalar() or 0
    
    events_res = await db.execute(select(ProtectionEvent))
    events = events_res.scalars().all()
    blocks = sum(1 for e in events if e.event_type == "LOGIN_BLOCKED")
    protected = len(events)
    
    avg_risk = (sum(t.risk_score for t in threats) / total) if total > 0 else 0.0
    
    return {
        "total_threats": total,
        "critical": critical,
        "high": high,
        "suspicious": suspicious,
        "low": low,
        "trusted": trusted,
        "students_protected": protected,
        "credential_blocks": blocks,
        "digital_twins": twins_count,
        "average_risk_score": round(avg_risk, 1)
    }

@router.get("/timeline")
async def get_dashboard_timeline(db: AsyncSession = Depends(get_db)):
    threats_res = await db.execute(
        select(Threat).order_by(Threat.detected_at.desc()).limit(10)
    )
    threats = threats_res.scalars().all()
    
    events_res = await db.execute(
        select(ProtectionEvent).order_by(ProtectionEvent.timestamp.desc()).limit(10)
    )
    events = events_res.scalars().all()
    
    timeline_items = []
    for t in threats:
        ts = (t.detected_at or datetime.now(timezone.utc)).isoformat()
        timeline_items.append({
            "time": ts,
            "event": "THREAT_SCORED",
            "label": f"Risk Score: {t.risk_score}% ({t.threat_status})",
            "website": t.domain or t.url,
            "raw_time": t.detected_at or datetime.min.replace(tzinfo=timezone.utc),
        })
    
    label_map = {
        "LOGIN_BLOCKED": "Credential Interception Blocked",
        "WARNING_DISPLAYED": "Security Warning Banner Displayed",
        "LOGIN_ALLOWED": "Authentication Allowed",
        "THREAT_IGNORED": "Warning Acknowledged / Proceeded",
    }

    for e in events:
        ts = (e.timestamp or datetime.now(timezone.utc)).isoformat()
        timeline_items.append({
            "time": ts,
            "event": e.event_type,
            "label": label_map.get(e.event_type, e.event_type),
            "website": e.domain,
            "raw_time": e.timestamp or datetime.min.replace(tzinfo=timezone.utc),
        })
    
    timeline_items.sort(key=lambda x: x["raw_time"], reverse=True)
    
    return [
        {
            "time": item["time"],
            "event": item["event"],
            "label": item["label"],
            "website": item["website"]
        }
        for item in timeline_items[:15]
    ]

@router.get("/statistics")
async def get_dashboard_statistics(db: AsyncSession = Depends(get_db)):
    threats_res = await db.execute(select(Threat))
    threats = threats_res.scalars().all()

    trusted = sum(1 for t in threats if t.risk_score < 25)
    low = sum(1 for t in threats if 25 <= t.risk_score < 50)
    suspicious = sum(1 for t in threats if 50 <= t.risk_score < 70)
    high = sum(1 for t in threats if 70 <= t.risk_score < 90)
    critical = sum(1 for t in threats if t.risk_score >= 90)

    now = datetime.now(timezone.utc)
    date_counts = {}
    for i in range(6, -1, -1):
        day_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        date_counts[day_str] = 0

    for t in threats:
        if t.detected_at:
            day_str = t.detected_at.strftime("%Y-%m-%d")
            if day_str in date_counts:
                date_counts[day_str] += 1

    threats_over_time = [{"date": d, "count": c} for d, c in date_counts.items()]

    portal_counts = {}
    for t in threats:
        portal = t.targeted_portal or "ERP"
        portal_counts[portal] = portal_counts.get(portal, 0) + 1

    most_targeted_portals = [
        {"portal": p, "count": c} for p, c in sorted(portal_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "risk_distribution": [
            {"name": "Trusted", "value": trusted},
            {"name": "Low", "value": low},
            {"name": "Suspicious", "value": suspicious},
            {"name": "High", "value": high},
            {"name": "Critical", "value": critical},
        ],
        "threats_over_time": threats_over_time,
        "most_targeted_portals": most_targeted_portals,
    }
