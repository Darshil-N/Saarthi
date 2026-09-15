from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from config import settings
from typing import Optional

bearer_scheme = HTTPBearer(auto_error=False)


def get_supabase() -> Client:
    """Service-role client — bypasses RLS for server-side writes."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


class CurrentUser:
    def __init__(self, id: str, email: str, role: str, raw_token: str):
        self.id = id
        self.email = email
        self.role = role
        self.raw_token = raw_token


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    token = credentials.credentials

    # Use Supabase to validate the JWT — works for both HS256 and ES256
    try:
        anon_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_KEY)
        user_resp = anon_client.auth.get_user(token)
        user = user_resp.user
        if not user:
            raise ValueError("No user returned")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )

    # Pull role from profiles table (most authoritative source)
    svc_client = get_supabase()
    profile = svc_client.table("profiles").select("role").eq("id", user.id).maybe_single().execute()
    role = (profile.data or {}).get("role") or "entry_operator"

    return CurrentUser(
        id=user.id,
        email=user.email or "",
        role=role,
        raw_token=token,
    )


def require_roles(*allowed_roles: str):
    """Dependency factory — raises 403 if the caller role is not in allowed_roles."""
    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted for this action",
            )
        return user
    return _check
