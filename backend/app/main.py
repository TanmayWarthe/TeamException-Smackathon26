import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
import os
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func
from datetime import datetime, timezone

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
        # Check if twins already seeded
        res = await session.execute(select(func.count(DigitalTwinModel.id)))
        count = res.scalar() or 0
        if count == 0:
            dataset_path = Path(__file__).resolve().parent.parent.parent / "legitimate_domains_dataset.json"
            if dataset_path.exists():
                try:
                    with open(dataset_path, "r", encoding="utf-8") as f:
                        items = json.load(f)
                    for item in items:
                        domain = item.get("domain", "").strip().lower()
                        name = item.get("website_name", "").strip()
                        url = item.get("official_url", "").strip()
                        if domain and url:
                            session.add(DigitalTwinModel(
                                website_name=name,
                                official_url=url,
                                domain=domain,
                                fingerprint_version=1,
                                screenshot_path="",
                                created_at=datetime.now(timezone.utc),
                                updated_at=datetime.now(timezone.utc),
                            ))
                    await session.commit()
                    print(f"[Startup] Automatically seeded {len(items)} legitimate domain twins into database.")
                except Exception as e:
                    print(f"[Startup] Dataset seeding notice: {e}")

def prewarm_clip():
    try:
        import sys, importlib.util
        from pathlib import Path
        root = Path(__file__).resolve().parent.parent
        spec = importlib.util.spec_from_file_location("clip", str(root / "digital-twin" / "embeddings" / "clip_embedder.py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod._load_model()
        print("[Startup] CLIP AI Model pre-warmed & ready in memory.")
    except Exception as e:
        print(f"[Startup] CLIP pre-warm notice: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables & seed
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_initial_data()
    asyncio.create_task(asyncio.to_thread(prewarm_clip))
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

@app.get("/api/screenshots/view")
async def get_screenshot_view(path: str):
    if not path:
        return {"error": "Path required"}
    p = Path(path)
    if not p.is_absolute():
        p = Path(__file__).resolve().parent.parent.parent / path
    if p.exists() and p.is_file():
        return FileResponse(str(p))
    return {"error": "File not found"}
