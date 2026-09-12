from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from supabase import create_client, Client
from config import settings
from typing import Optional
import httpx

bearer_scheme = HTTPBearer(auto_error=False)


def get_supabase() -> Client:
    """Return a Supabase client using the service-role key (bypasses RLS for writes)."""
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
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )

    user_id: str = payload.get("sub") or ""
    email: str = payload.get("email") or ""
    # Role is stored in app_metadata or a custom claim
    app_meta = payload.get("app_metadata") or {}
    role: str = app_meta.get("role") or payload.get("role") or "entry_operator"

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    return CurrentUser(id=user_id, email=email, role=role, raw_token=token)


def require_roles(*allowed_roles: str):
    """Dependency factory – raises 403 if the caller's role is not in allowed_roles."""
    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted for this action",
            )
        return user
    return _check
