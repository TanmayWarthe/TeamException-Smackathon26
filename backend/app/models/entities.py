import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON
from ..database.session import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="ADMIN")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Threat(Base):
    __tablename__ = "threats"

    id = Column(String, primary_key=True, default=generate_uuid)
    url = Column(String, nullable=False, index=True)
    domain = Column(String, nullable=False, index=True)
    targeted_portal = Column(String, default="ERP")
    risk_score = Column(Integer, nullable=False)
    confidence = Column(Integer, default=90)
    threat_status = Column(String, default="ACTIVE") # ACTIVE, BLOCKED, RESOLVED, IGNORED
    recommendation = Column(String, default="BLOCK")
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    screenshot_path = Column(String, default="")
    official_screenshot_path = Column(String, default="")
    ip_address = Column(String, default="185.220.101.4")
    registrar = Column(String, default="NameCheap Inc.")
    ssl_status = Column(String, default="Valid (Recently Issued)")
    admin_notes = Column(Text, default="")
    
    # Detailed telemetry JSONs
    similarity_report = Column(JSON, default=dict)
    risk_breakdown = Column(JSON, default=list)
    explanation = Column(JSON, default=dict)
    evidence = Column(JSON, default=dict)
    timeline = Column(JSON, default=list)

class DigitalTwinModel(Base):
    __tablename__ = "digital_twins"

    id = Column(String, primary_key=True, default=generate_uuid)
    website_name = Column(String, nullable=False)
    official_url = Column(String, nullable=False, unique=True)
    domain = Column(String, nullable=False, index=True)
    fingerprint_version = Column(Integer, default=1)
    screenshot_path = Column(String, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    read_status = Column(Boolean, default=False)
    threat_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ProtectionEvent(Base):
    __tablename__ = "protection_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    event_type = Column(String, nullable=False) # WARNING_DISPLAYED, LOGIN_BLOCKED, LOGIN_ALLOWED, THREAT_IGNORED
    domain = Column(String, nullable=False)
    browser = Column(String, default="Chrome")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    details = Column(JSON, default=dict)
