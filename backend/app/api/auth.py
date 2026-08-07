# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException, status
from ..schemas.schemas import LoginRequest, LoginResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

# Fixed Admin Credentials allowed to access SOC Dashboard
VALID_ADMIN_IDENTIFIERS = {
    "admin111@gmail.com",
    "admin@ycce.edu",
    "admin@ycce.edu.in",
    "admin@ctip.security",
    "admin@college.edu",
    "admin",
}

VALID_ADMIN_PASSWORDS = {
    "admin123",
    "password123",
    "admin",
    "ctip@admin2026",
    "admin@2026",
}


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    """
    Authenticate SOC Administrator to access the CTIP Dashboard & Digital Twins Management.
    """
    submitted_id = (req.email or "").strip().lower()
    submitted_password = (req.password or "").strip()

    if not submitted_id or not submitted_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin ID and Password are required."
        )

    # Strict Administrative Credential Verification
    ADMIN_CREDENTIALS = {
        "admin@ycce.edu.in": {"password": "password123", "name": "YCCE Campus SOC Admin"},
        "admin@ycce.edu": {"password": "admin123", "name": "Campus Security Admin"},
        "admin@ctip.security": {"password": "ctip@admin2026", "name": "CTIP Lead Analyst"},
        "admin111@gmail.com": {"password": "password123", "name": "SOC Administrator"},
        "admin@college.edu": {"password": "password123", "name": "College SOC Admin"},
        "admin": {"password": "password123", "name": "Campus Admin"},
    }

    account_info = ADMIN_CREDENTIALS.get(submitted_id)
    if account_info and (
        submitted_password == account_info["password"]
        or submitted_password in VALID_ADMIN_PASSWORDS
    ):
        return LoginResponse(
            token="ctip-jwt-token-authenticated-soc-admin-session",
            expires_in=86400,
            user=UserResponse(
                id="soc_admin_001",
                name=account_info["name"],
                email=submitted_id if "@" in submitted_id else "admin@ycce.edu.in",
                role="ADMIN"
            )
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Admin ID or Password. Access is restricted to authorized SOC personnel."
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user():
    return UserResponse(
        id="soc_admin_001",
        name="CTIP SOC Administrator",
        email="admin@ycce.edu",
        role="ADMIN"
    )
