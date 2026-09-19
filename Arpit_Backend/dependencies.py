import logging
import threading
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from gotrue.errors import AuthError
from supabase import Client, create_client

from config import settings

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Shared service-role client (bypasses RLS) for server-side reads and writes.

    It must never be used to sign a user in: signing in replaces the client's credentials
    with the user's token, which would silently turn every later query into an RLS-bound one.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


@lru_cache(maxsize=1)
def _get_token_verifier() -> Client:
    """Client used only to ask Supabase Auth whether an access token is valid."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_KEY)


def new_auth_client() -> Client:
    """Throw-away client for sign-in flows, so user credentials never leak into shared clients."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_KEY)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    role: str
    raw_token: str


class _TTLCache:
    """Small thread-safe cache with per-entry expiry and a size bound."""

    def __init__(self, ttl_seconds: float, max_size: int = 1024):
        self._ttl = ttl_seconds
        self._max_size = max_size
        self._data: dict[str, tuple[float, CurrentUser]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[CurrentUser]:
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at <= time.monotonic():
                del self._data[key]
                return None
            return value

    def set(self, key: str, value: CurrentUser) -> None:
        if self._ttl <= 0:
            return
        with self._lock:
            if len(self._data) >= self._max_size:
                now = time.monotonic()
                self._data = {k: v for k, v in self._data.items() if v[0] > now}
                if len(self._data) >= self._max_size:
                    self._data.pop(next(iter(self._data)))
            self._data[key] = (time.monotonic() + self._ttl, value)

    def discard(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


_user_cache = _TTLCache(settings.AUTH_CACHE_TTL_SECONDS)


def forget_token(token: str) -> None:
    """Drop a token from the auth cache (used on logout)."""
    _user_cache.discard(token)


def load_active_profile(supabase: Client, user_id: str) -> dict:
    """Return the caller's profile row, or raise 403 if it is missing, role-less or deactivated."""
    resp = (
        supabase.table("profiles")
        .select("role, is_active")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    profile = resp.data if resp else None
    if not profile or not profile.get("role"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No profile is configured for this account")
    if profile.get("is_active") is False:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="This account has been deactivated")
    return profile


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    supabase: Client = Depends(get_supabase),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = credentials.credentials

    cached = _user_cache.get(token)
    if cached is not None:
        return cached

    # Let Supabase validate the JWT (works for HS256 and ES256 projects alike).
    try:
        user = _get_token_verifier().auth.get_user(token).user
    except AuthError as exc:
        logger.info("Rejected access token: %s", exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    except Exception:
        logger.exception("Token verification failed because Supabase Auth could not be reached")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service unavailable")
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    profile = load_active_profile(supabase, user.id)
    current = CurrentUser(id=user.id, email=user.email or "", role=profile["role"], raw_token=token)
    _user_cache.set(token, current)
    return current


def require_roles(*allowed_roles: str):
    """Dependency factory: responds 403 unless the caller's role is one of allowed_roles."""

    def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted for this action",
            )
        return user

    return _check
