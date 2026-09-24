import logging
import secrets
import string
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from supabase import Client

from dependencies import CurrentUser, get_supabase, require_roles
from services.audit_service import log_action
from services.validators import require_uuid

logger = logging.getLogger(__name__)

router = APIRouter()

_ROLES = ("admin", "entry_operator", "engineer", "accounts")


class CreateUserRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    role: str
    department: Optional[str] = Field(default=None, max_length=100)


class SetActiveRequest(BaseModel):
    is_active: bool


def _generate_temp_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(16))


@router.get("")
def list_users(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles("admin")),
):
    profiles = (
        supabase.table("profiles")
        .select("id, full_name, role, department, employee_id, is_active, created_at")
        .order("created_at", desc=True)
        .execute()
    ).data or []

    # Email lives in Supabase Auth, not profiles; best-effort enrichment so a failure here
    # doesn't take down the whole list — role/status (the fields governance actually needs)
    # still show correctly either way.
    email_by_id: dict[str, str] = {}
    try:
        for u in supabase.auth.admin.list_users():
            email_by_id[u.id] = u.email
    except Exception:
        logger.warning("Could not fetch auth emails for the user list", exc_info=True)

    return [{**p, "email": email_by_id.get(p["id"])} for p in profiles]


@router.post("")
def create_user(
    body: CreateUserRequest,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles("admin")),
):
    """Plan step 7.4.1 — admin-only create-user (real auth user + profile).

    Creates the real Supabase Auth user; handle_new_user then creates its profile row
    automatically as entry_operator / inactive (migration 001's least-privilege default), so the
    intended role and active status are applied right after, in the same request.

    A random temporary password is generated and returned once in the response — there is no
    email delivery configured to invite the user instead. It is never logged (only the fact that
    a user was created is audited, not the password itself).
    """
    if body.role not in _ROLES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"role must be one of {', '.join(_ROLES)}")

    temp_password = _generate_temp_password()
    try:
        result = supabase.auth.admin.create_user({
            "email": body.email,
            "password": temp_password,
            "email_confirm": True,
            "user_metadata": {"full_name": body.full_name},
        })
    except Exception:
        logger.warning("Could not create an auth user for %s", body.email, exc_info=True)
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Could not create this user — the email may already be registered",
        )

    user_id = result.user.id
    supabase.table("profiles").update({
        "role": body.role,
        "is_active": True,
        "department": body.department,
        "full_name": body.full_name,
    }).eq("id", user_id).execute()

    log_action(supabase, current_user.id, current_user.role, "user_created", "user", user_id,
               None, {"email": body.email, "role": body.role})

    return {
        "id": user_id,
        "email": body.email,
        "full_name": body.full_name,
        "role": body.role,
        "temporary_password": temp_password,
    }


@router.patch("/{user_id}/active")
def set_user_active(
    user_id: str,
    body: SetActiveRequest,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles("admin")),
):
    """Plan step 7.4.2 — enforce is_active and prevent an admin from deactivating themselves.
    The self-check compares the raw path value before UUID validation, so it still catches
    "that's me" even if the id were ever presented in a non-canonical form."""
    if user_id == current_user.id and not body.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own account")
    user_id = require_uuid(user_id, "User")

    existing = supabase.table("profiles").select("id, is_active").eq("id", user_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    resp = supabase.table("profiles").update({"is_active": body.is_active}).eq("id", user_id).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Update failed")

    log_action(
        supabase, current_user.id, current_user.role,
        "user_activated" if body.is_active else "user_deactivated", "user", user_id,
        {"is_active": existing.data.get("is_active")}, {"is_active": body.is_active},
    )
    return resp.data[0]
