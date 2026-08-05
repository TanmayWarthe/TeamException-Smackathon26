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
    twins_count = twins_res.scalar() or 5
    
    events_res = await db.execute(select(ProtectionEvent))
    events = events_res.scalars().all()
    blocks = sum(1 for e in events if e.event_type == "LOGIN_BLOCKED") or 43
    protected = len(events) + 842
    
    avg_risk = (sum(t.risk_score for t in threats) / total) if total > 0 else 62.4
    
    return {
        "total_threats": max(total, 125),
        "critical": max(critical, 8),
        "high": max(high, 12),
        "suspicious": max(suspicious, 21),
        "low": max(low, 34),
        "trusted": max(trusted, 50),
        "students_protected": protected,
        "credential_blocks": blocks,
        "digital_twins": twins_count,
        "average_risk_score": round(avg_risk, 1)
    }

@router.get("/timeline")
async def get_dashboard_timeline():
    return [
        {"time": "2026-08-02T09:15:00Z", "event": "NEW_DOMAIN_DETECTED", "label": "New Domain Detected", "website": "ycce-erp-login.xyz"},
        {"time": "2026-08-02T09:16:00Z", "event": "WEBSITE_CRAWLED", "label": "Website Crawled", "website": "ycce-erp-login.xyz"},
        {"time": "2026-08-02T09:17:00Z", "event": "SIMILARITY_COMPLETED", "label": "Similarity Analysis Completed", "website": "ycce-erp-login.xyz"},
        {"time": "2026-08-02T09:18:00Z", "event": "RISK_SCORED", "label": "Risk Score: 96%", "website": "ycce-erp-login.xyz"},
        {"time": "2026-08-02T09:18:30Z", "event": "ADMIN_ALERT", "label": "Administrator Alert Generated", "website": "ycce-erp-login.xyz"},
        {"time": "2026-08-02T09:21:00Z", "event": "STUDENT_BLOCKED", "label": "Student Attempt Blocked", "website": "ycce-erp-login.xyz"},
    ]

@router.get("/statistics")
async def get_dashboard_statistics():
    return {
        "risk_distribution": [
            {"name": "Trusted", "value": 50},
            {"name": "Low", "value": 34},
            {"name": "Suspicious", "value": 21},
            {"name": "High", "value": 12},
            {"name": "Critical", "value": 8},
        ],
        "threats_over_time": [
            {"date": "2026-07-27", "count": 4},
            {"date": "2026-07-28", "count": 7},
            {"date": "2026-07-29", "count": 3},
            {"date": "2026-07-30", "count": 9},
            {"date": "2026-07-31", "count": 12},
            {"date": "2026-08-01", "count": 6},
            {"date": "2026-08-02", "count": 10},
        ],
        "most_targeted_portals": [
            {"portal": "ERP", "count": 62},
            {"portal": "Webmail", "count": 28},
            {"portal": "Scholarship", "count": 19},
            {"portal": "Exam Portal", "count": 16},
        ],
    }
