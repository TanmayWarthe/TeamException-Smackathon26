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
        # Database initializes clean without pre-populated fake threats
        pass

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
