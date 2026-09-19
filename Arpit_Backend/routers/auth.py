import logging

from fastapi import APIRouter, Depends, HTTPException, status
from gotrue.errors import AuthError
from supabase import Client

from dependencies import (
    CurrentUser,
    forget_token,
    get_current_user,
    get_supabase,
    load_active_profile,
    new_auth_client,
)
from models.auth import LoginRequest, LoginResponse, UserProfile

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, supabase: Client = Depends(get_supabase)):
    """Authenticate with Supabase Auth and return the session tokens plus the user's role."""
    try:
        resp = new_auth_client().auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except AuthError as exc:
        logger.info("Login rejected for %s: %s", body.email, exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    except Exception:
        logger.exception("Login failed because Supabase Auth could not be reached")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service unavailable")

    session, user = resp.session, resp.user
    if not session or not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    profile = load_active_profile(supabase, user.id)

    return LoginResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        token_type="bearer",
        role=profile["role"],
        user_id=user.id,
        email=user.email or "",
    )


@router.post("/logout")
def logout(
    current_user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Revoke the caller's session on Supabase and drop it from the local auth cache."""
    forget_token(current_user.raw_token)
    try:
        supabase.auth.admin.sign_out(current_user.raw_token)
    except Exception:
        # The client discards its tokens either way, so a failed revoke must not block logout.
        logger.warning("Could not revoke session for user %s", current_user.id, exc_info=True)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserProfile)
def me(
    current_user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    resp = (
        supabase.table("profiles")
        .select("id, full_name, role, department, employee_id, is_active")
        .eq("id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Profile not found")
    profile = resp.data
    profile["email"] = current_user.email  # from the verified token, not the profiles table
    return UserProfile(**profile)
