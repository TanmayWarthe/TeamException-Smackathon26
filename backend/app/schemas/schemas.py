from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field

# ── Auth ───────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str

class LoginResponse(BaseModel):
    token: str
    expires_in: int
    user: UserResponse

# ── Analysis Request / Response ────────────────────────────────
class CandidateAnalyzeRequest(BaseModel):
    url: str
    domain: Optional[str] = None
    title: Optional[str] = None
    html: Optional[str] = None          # Full page HTML submitted directly (preferred)
    domSnapshot: Optional[str] = None   # CamelCase alias accepted from Chrome extension
    dom_snapshot: Optional[str] = None  # Snake_case alias accepted from Chrome extension
    inputFieldCount: Optional[int] = 0
    buttonLabels: Optional[list[str]] = []
    logoSrc: Optional[str] = None
    timestamp: Optional[str] = None

class AnalysisResponse(BaseModel):
    status: str
    risk_score: int
    confidence: int
    recommendation: str
    reasons: list[str]

# ── Threats ────────────────────────────────────────────────────
class ThreatListItem(BaseModel):
    id: str
    url: str
    domain: str
    targeted_portal: str
    risk_score: int
    confidence: int
    threat_status: str
    detected_at: str
    screenshot_path: str

class ThreatDetailResponse(BaseModel):
    id: str
    url: str
    domain: str
    ip_address: str
    registrar: str
    ssl_status: str
    risk_score: int
    confidence: int
    threat_status: str
    targeted_portal: str
    detected_at: str
    screenshot_path: str
    official_screenshot_path: str
    similarity_report: dict[str, Any]
    risk_breakdown: list[dict[str, Any]]
    explanation: dict[str, Any]
    evidence: dict[str, Any]
    timeline: list[dict[str, Any]]
    admin_notes: str

class UpdateThreatStatusRequest(BaseModel):
    status: str # ACTIVE, BLOCKED, RESOLVED, IGNORED
    notes: Optional[str] = None

# ── Digital Twin ───────────────────────────────────────────────
class DigitalTwinResponse(BaseModel):
    id: str
    website_name: str
    official_url: str
    fingerprint_version: int
    screenshot_path: str
    created_at: str
    updated_at: str

class CreateDigitalTwinRequest(BaseModel):
    website_name: str
    official_url: str

# ── Notifications ──────────────────────────────────────────────
class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    read_status: bool
    created_at: str
    threat_id: Optional[str] = None

# ── Events / Telemetry ─────────────────────────────────────────
class ProtectionEventCreate(BaseModel):
    event_type: str # WARNING_DISPLAYED, LOGIN_BLOCKED, LOGIN_ALLOWED, THREAT_IGNORED
    domain: str
    browser: Optional[str] = "Chrome"
    details: Optional[dict[str, Any]] = None

class DashboardStatsResponse(BaseModel):
    total_threats: int
    critical: int
    high: int
    suspicious: int
    low: int
    trusted: int
    students_protected: int
    credential_blocks: int
    digital_twins: int
    average_risk_score: float
