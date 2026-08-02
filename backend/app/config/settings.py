import os
from pathlib import Path
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "Campus Threat Intelligence Platform (CTIP)"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Root path
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR}/ctip.db")
    
    # Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "ctip-secret-key-hackathon-2026-super-secure")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "chrome-extension://*",
        "*"
    ]

settings = Settings()
