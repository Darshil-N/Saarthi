import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from dependencies import CurrentUser, get_supabase, require_roles
from services.validators import require_uuid

logger = logging.getLogger(__name__)

router = APIRouter()

# audit_log's own RLS policy (audit_select_admin) already restricts reads to admins; this
# mirrors that at the API layer so the error is a clean 403 rather than an empty result.
_READERS = ("admin",)


@router.get("")
def list_audit_log(
    actor_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_READERS)),
):
    """Plan step 7.2.1 — paginated audit query with filters. Real columns/values only:
    action is free text (e.g. receipt_confirmed, material_approved, mapping_rejected,
    materials_merged, cnmc_generated, user_created, user_deactivated); entity_type is the table
    name (materials, goods_receipts, matching_queue, user)."""
    q = supabase.table("audit_log").select(
        "id, actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, created_at, "
        "profiles(full_name)"
    )
    if actor_id:
        q = q.eq("actor_id", require_uuid(actor_id, "Actor"))
    if action:
        q = q.eq("action", action)
    if entity_type:
        q = q.eq("entity_type", entity_type)
    if from_date:
        q = q.gte("created_at", from_date)
    if to_date:
        q = q.lte("created_at", to_date)

    try:
        rows = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute().data or []
    except Exception:
        logger.exception("Could not load the audit log")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Could not load the audit log")

    return [
        {
            "id": r["id"],
            "actor_id": r.get("actor_id"),
            "actor_name": (r.get("profiles") or {}).get("full_name") or "Unknown",
            "actor_role": r.get("actor_role"),
            "action": r["action"],
            "entity_type": r["entity_type"],
            "entity_id": r.get("entity_id"),
            "old_value": r.get("old_value"),
            "new_value": r.get("new_value"),
            "created_at": r["created_at"],
        }
        for r in rows
    ]
