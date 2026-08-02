from fastapi import APIRouter, HTTPException, status
from ..schemas.schemas import LoginRequest, LoginResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    # For demo / hackathon: accept valid login
    if req.email and req.password:
        return LoginResponse(
            token="ctip-jwt-token-authenticated-session",
            expires_in=86400,
            user=UserResponse(
                id="usr_001",
                name="CTIP Administrator",
                email=req.email,
                role="ADMIN"
            )
        )
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid credentials")

@router.get("/me", response_model=UserResponse)
async def get_current_user():
    return UserResponse(
        id="usr_001",
        name="CTIP Administrator",
        email="admin@ycce.edu.in",
        role="ADMIN"
    )
