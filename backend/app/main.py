import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config.settings import settings
from .database.session import engine, Base, AsyncSessionLocal
from .models.entities import Threat, DigitalTwinModel, Notification, User
from .api.auth import router as auth_router
from .api.analyze import router as analyze_router
from .api.dashboard import router as dashboard_router
from .api.threats import router as threats_router
from .api.digital_twins import router as digital_twins_router
from .api.notifications import router as notifications_router
from .api.events import router as events_router
from .websocket.manager import ws_manager, ConnectionManager

manager = ws_manager

async def seed_initial_data():
    async with AsyncSessionLocal() as session:
        # Check if threats already seeded
        res = await session.execute(select(Threat))
        if res.scalars().first() is None:
            # Seed default threats
            t1 = Threat(
                id="thr_001",
                url="https://ycce-erp-login.xyz",
                domain="ycce-erp-login.xyz",
                targeted_portal="ERP",
                risk_score=96,
                confidence=98,
                threat_status="ACTIVE",
                screenshot_path="/mock/screenshots/threat_001.png",
                official_screenshot_path="/mock/screenshots/official_erp.png",
                similarity_report={
                    "visual_similarity": 97.4,
                    "dom_similarity": 95.8,
                    "css_similarity": 94.1,
                    "logo_similarity": 100.0,
                    "form_similarity": 99.0,
                    "ssl_similarity": 70.0,
                    "javascript_similarity": 92.3,
                    "url_similarity": 18.0,
                    "overall_similarity": 91.2,
                },
                risk_breakdown=[
                    {"feature": "Visual Similarity", "score": 98, "weight": 25, "contribution": 24.5},
                    {"feature": "DOM Similarity", "score": 96, "weight": 20, "contribution": 19.2},
                    {"feature": "Form Similarity", "score": 97, "weight": 20, "contribution": 19.4},
                    {"feature": "JavaScript Behaviour", "score": 92, "weight": 15, "contribution": 13.8},
                    {"feature": "Logo Similarity", "score": 100, "weight": 10, "contribution": 10.0},
                    {"feature": "URL Intelligence", "score": 18, "weight": 5, "contribution": 0.9},
                    {"feature": "SSL Trust", "score": 70, "weight": 5, "contribution": 3.5},
                ],
                explanation={
                    "risk_score": 96,
                    "reasons": [
                        "Copied Institutional Logo",
                        "Highly Similar DOM Structure",
                        "Credential Submission Redirected to Unknown Server",
                        "Suspicious Domain (Recently Registered)",
                        "Recently Issued SSL Certificate",
                    ],
                    "recommendation": "Do Not Enter Credentials",
                }
            )
            t2 = Threat(
                id="thr_002",
                url="https://ycceportal.site",
                domain="ycceportal.site",
                targeted_portal="Student Portal",
                risk_score=82,
                confidence=91,
                threat_status="ACTIVE",
                screenshot_path="/mock/screenshots/threat_002.png",
                official_screenshot_path="/mock/screenshots/official_portal.png",
            )
            t3 = Threat(
                id="thr_003",
                url="https://ycce-webmail-secure.net",
                domain="ycce-webmail-secure.net",
                targeted_portal="Webmail",
                risk_score=58,
                confidence=74,
                threat_status="ACTIVE",
                screenshot_path="/mock/screenshots/threat_003.png",
                official_screenshot_path="/mock/screenshots/official_webmail.png",
            )
            session.add_all([t1, t2, t3])
            
            # Seed Digital Twins
            dt1 = DigitalTwinModel(
                id="dt_001",
                website_name="YCCE ERP",
                official_url="https://erp.ycce.edu.in",
                domain="erp.ycce.edu.in",
                fingerprint_version=3,
                screenshot_path="/mock/screenshots/official_erp.png"
            )
            dt2 = DigitalTwinModel(
                id="dt_002",
                website_name="YCCE Webmail",
                official_url="https://mail.ycce.edu.in",
                domain="mail.ycce.edu.in",
                fingerprint_version=1,
                screenshot_path="/mock/screenshots/official_webmail.png"
            )
            dt3 = DigitalTwinModel(
                id="dt_003",
                website_name="YCCE Student Portal",
                official_url="https://student.ycce.edu.in",
                domain="student.ycce.edu.in",
                fingerprint_version=2,
                screenshot_path="/mock/screenshots/official_portal.png"
            )
            session.add_all([dt1, dt2, dt3])
            
            # Seed Notifications
            n1 = Notification(
                id="ntf_001",
                title="Critical Threat Detected",
                message="ycce-erp-login.xyz scored 96% risk. Immediate review recommended.",
                read_status=False,
                threat_id="thr_001"
            )
            n2 = Notification(
                id="ntf_002",
                title="High Risk Threat Detected",
                message="ycceportal.site scored 82% risk.",
                read_status=False,
                threat_id="thr_002"
            )
            session.add_all([n1, n2])
            
            await session.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables & seed
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_initial_data()
    yield
    # Shutdown
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket for real-time threat broadcasts
@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle heartbeat ping/pong or client subscriptions
            if data == "ping" or data == '{"type":"ping"}':
                await ws_manager.send_personal_message({"type": "pong"}, websocket)
    except (WebSocketDisconnect, Exception):
        ws_manager.disconnect(websocket)

# Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(analyze_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(threats_router, prefix=settings.API_V1_STR)
app.include_router(digital_twins_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(events_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root_index():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "health_check": "/api/health",
        "api_endpoints": {
            "auth": f"{settings.API_V1_STR}/auth/login",
            "dashboard": f"{settings.API_V1_STR}/dashboard",
            "threats": f"{settings.API_V1_STR}/threats",
            "digital_twins": f"{settings.API_V1_STR}/digital-twins",
            "analyze": f"{settings.API_V1_STR}/analyze",
            "notifications": f"{settings.API_V1_STR}/notifications",
            "events": f"{settings.API_V1_STR}/events"
        }
    }

@app.get("/api")
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME, "version": settings.VERSION}
