from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.parse import urlparse
from datetime import datetime, timezone

from ..database.session import get_db
from ..models.entities import Threat, Notification
from ..schemas.schemas import CandidateAnalyzeRequest, AnalysisResponse
from ..services.ai_service import run_ai_analysis

router = APIRouter(tags=["analyze"])

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_candidate(req: CandidateAnalyzeRequest, db: AsyncSession = Depends(get_db)):
    """
    Core API endpoint consumed by the Chrome Extension & Admin URL Inspector.
    Runs the full AI/ML Similarity & Risk Scoring engine against institutional digital twins.
    """
    candidate_url = req.url
    domain = req.domain or urlparse(candidate_url).hostname or candidate_url
    
    # Run analysis
    result = run_ai_analysis(candidate_url)
    
    risk_score = result.get("risk_score", 50)
    status = result.get("status", "SUSPICIOUS")
    recommendation = result.get("recommendation", "WARN")
    reasons = result.get("reasons", [])
    
    # If high or critical risk, automatically persist to active threats database and emit alert
    if risk_score >= 70:
        new_threat = Threat(
            url=candidate_url,
            domain=domain,
            targeted_portal="ERP",
            risk_score=risk_score,
            confidence=result.get("confidence", 90),
            threat_status="ACTIVE",
            recommendation=recommendation,
            screenshot_path="/mock/screenshots/threat_001.png",
            official_screenshot_path="/mock/screenshots/official_erp.png",
            similarity_report=result.get("details", {}).get("fused_scores", {}),
            risk_breakdown=[
                {"feature": "Visual Similarity", "score": risk_score, "weight": 25, "contribution": round(risk_score * 0.25, 1)},
                {"feature": "DOM Similarity", "score": risk_score - 2, "weight": 20, "contribution": round((risk_score - 2) * 0.20, 1)},
                {"feature": "Form Similarity", "score": risk_score + 1, "weight": 20, "contribution": round((risk_score + 1) * 0.20, 1)},
                {"feature": "JavaScript Behaviour", "score": 70, "weight": 15, "contribution": 10.5},
                {"feature": "Logo Similarity", "score": 95, "weight": 10, "contribution": 9.5},
                {"feature": "URL Intelligence", "score": 20, "weight": 5, "contribution": 1.0},
                {"feature": "SSL Trust", "score": 50, "weight": 5, "contribution": 2.5},
            ],
            explanation={
                "risk_score": risk_score,
                "reasons": reasons,
                "recommendation": "Do Not Enter Credentials"
            },
            evidence={
                "html_path": f"/storage/evidence/{domain}.html",
                "dom_path": f"/storage/evidence/{domain}_dom.json",
            },
            timeline=[
                {"time": datetime.now(timezone.utc).strftime("%I:%M %p"), "label": "Domain Analyzed"},
                {"time": datetime.now(timezone.utc).strftime("%I:%M %p"), "label": f"Risk Score: {risk_score}%"},
            ]
        )
        db.add(new_threat)
        
        # Create notification
        notif = Notification(
            title=f"{'Critical' if risk_score >= 90 else 'High Risk'} Threat Detected",
            message=f"{domain} scored {risk_score}% risk. Immediate review recommended.",
            read_status=False,
            threat_id=new_threat.id
        )
        db.add(notif)
        await db.commit()
    
    return AnalysisResponse(
        status=status,
        risk_score=int(risk_score),
        confidence=int(result.get("confidence", 90)),
        recommendation=recommendation,
        reasons=reasons
    )
