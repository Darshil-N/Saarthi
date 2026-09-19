from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from dependencies import CurrentUser, get_current_user, get_supabase, require_roles
from services.audit_service import log_action
from services.validators import require_uuid

router = APIRouter()

# Who may review mappings is an open product decision (plan D-7); this keeps today's behaviour.
_REVIEWERS = ("entry_operator", "engineer", "admin")


@router.get("")
def list_pending(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    resp = (
        supabase.table("v_matching_queue_detailed")
        .select("*")
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
    )
    return resp.data or []


def _review(match_id: str, new_status: str, action: str, supabase: Client, user: CurrentUser) -> dict:
    match_id = require_uuid(match_id, "Match")
    row = supabase.table("matching_queue").select("id, status").eq("id", match_id).maybe_single().execute()
    if not row or not row.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Match not found")
    if row.data["status"] != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"This match was already reviewed (status: {row.data['status']})",
        )

    # The status filter makes the update a compare-and-set: a concurrent reviewer cannot be overwritten.
    updated = (
        supabase.table("matching_queue")
        .update({
            "status": new_status,
            "reviewed_by": user.id,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", match_id)
        .eq("status", "pending")
        .execute()
    )
    if not updated.data:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="This match was just reviewed by someone else")

    log_action(supabase, user.id, user.role, action, "matching_queue", match_id,
               {"status": "pending"}, {"status": new_status})
    return {"status": new_status, "match_id": match_id}


@router.patch("/{match_id}/approve")
def approve_match(
    match_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_REVIEWERS)),
):
    return _review(match_id, "approved", "mapping_approved", supabase, current_user)


@router.patch("/{match_id}/reject")
def reject_match(
    match_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_REVIEWERS)),
):
    return _review(match_id, "rejected", "mapping_rejected", supabase, current_user)
