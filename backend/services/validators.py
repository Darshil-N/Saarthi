import uuid

from fastapi import HTTPException, status


def require_uuid(value: str, what: str = "Resource") -> str:
    """Return the canonical form of a UUID path/query value, or raise 404.

    Passing a malformed id to PostgREST fails with a database error (HTTP 500 for us);
    a malformed id can never match a row, so 404 is the honest answer.
    """
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"{what} not found")
