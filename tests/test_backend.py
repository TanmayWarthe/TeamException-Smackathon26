import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from backend.app.main import app, seed_initial_data
from backend.app.database.session import engine, Base

@pytest_asyncio.fixture(autouse=True, scope="function")
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_initial_data()
    yield

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_auth_login():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/auth/login", json={"email": "admin@ycce.edu.in", "password": "password123"})
        assert res.status_code == 200
        data = res.json()
        assert "token" in data
        assert data["user"]["email"] == "admin@ycce.edu.in"

@pytest.mark.asyncio
async def test_dashboard():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/dashboard")
        assert res.status_code == 200
        data = res.json()
        assert "total_threats" in data
        assert "critical" in data

@pytest.mark.asyncio
async def test_threats_list():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/threats")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 3

@pytest.mark.asyncio
async def test_analyze_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/analyze", json={"url": "https://ycce-erp-login.xyz"})
        assert res.status_code == 200
        data = res.json()
        assert "risk_score" in data
        assert "status" in data
        assert "recommendation" in data
