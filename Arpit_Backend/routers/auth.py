from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
import httpx

from dependencies import get_supabase, get_current_user, CurrentUser
from models.auth import LoginRequest, LoginResponse, UserProfile
from config import settings

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, supabase: Client = Depends(get_supabase)):
    """Authenticate with Supabase Auth and return JWT + role."""
    try:
        resp = supabase.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    session = resp.session
    user = resp.user
    if not session or not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Fetch profile for role
    profile_resp = supabase.table("profiles").select("role").eq("id", user.id).single().execute()
    role = (profile_resp.data or {}).get("role", "entry_operator")

    return LoginResponse(
        access_token=session.access_token,
        token_type="bearer",
        role=role,
        user_id=user.id,
        email=user.email or "",
    )


@router.post("/logout")
async def logout(
    current_user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    supabase.auth.sign_out()
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserProfile)
async def me(
    current_user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    resp = (
        supabase.table("profiles")
        .select("id, full_name, role, department, employee_id, is_active")
        .eq("id", current_user.id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile = resp.data
    profile["email"] = current_user.email  # attach from JWT
    return UserProfile(**profile)
