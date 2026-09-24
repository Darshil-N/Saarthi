import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from postgrest.exceptions import APIError
from supabase import Client

from dependencies import CurrentUser, get_current_user, get_supabase, require_roles
from services.validators import require_uuid

logger = logging.getLogger(__name__)

router = APIRouter()

# Plan D-7 (decided 2026-09-22): entry operator, engineer, accounts and admin may all review mappings.
_REVIEWERS = ("entry_operator", "engineer", "accounts", "admin")
_STATUSES = ("pending", "approved", "rejected", "auto_resolved")


@router.get("")
def list_matches(
    status_filter: str | None = Query(None, alias="status"),
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Defaults to pending (the entry-operator Pending Approvals screen's original contract).
    Pass status=all for every row (admin Duplicate Detection, plan step 7.3.1), or a specific
    status to filter to just that one."""
    if status_filter and status_filter not in ("all", *_STATUSES):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown status '{status_filter}'")

    q = supabase.table("v_matching_queue_detailed").select("*")
    if not status_filter:
        q = q.eq("status", "pending")
    elif status_filter != "all":
        q = q.eq("status", status_filter)
    resp = q.order("created_at", desc=False).execute()
    return resp.data or []


@router.get("/stats")
def matching_stats(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Counts by status for the admin Duplicate Detection screen (plan step 7.3.1)."""
    def count(status_val: str | None = None) -> int:
        q = supabase.table("matching_queue").select("id", count="exact")
        if status_val:
            q = q.eq("status", status_val)
        return q.limit(1).execute().count or 0

    try:
        return {
            "total": count(),
            "pending": count("pending"),
            "approved": count("approved"),
            "rejected": count("rejected"),
            "autoResolved": count("auto_resolved"),
        }
    except Exception:
        logger.exception("Could not load matching queue statistics")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Could not load matching queue statistics")


async def _review(match_id: str, action: str, supabase: Client, user: CurrentUser) -> dict:
    """Approve or reject a match via the approve_mapping RPC (plan step 1.2.3), which — for an
    approval — merges stock, repoints purchase/price history, and deprecates the duplicate, all
    in one transaction. FOR UPDATE inside the RPC is what actually prevents two reviewers from
    both winning (the caller's job is just to turn the RPC's outcome into the right HTTP status).
    """
    match_id = require_uuid(match_id, "Match")
    try:
        resp = await asyncio.to_thread(
            lambda: supabase.rpc("approve_mapping", {
                "p_match_id": match_id,
                "p_reviewer_id": user.id,
                "p_reviewer_role": user.role,
                "p_action": action,
            }).execute()
        )
    except APIError as exc:
        msg = str(exc)
        if "NOT_FOUND:" in msg:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Match not found")
        if "ALREADY_REVIEWED:" in msg:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="This match was already reviewed")
        logger.exception("approve_mapping RPC failed for match %s (%s)", match_id, action)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not review this match. Please try again.")

    result = resp.data or {}
    return {"status": result["status"], "match_id": result["match_id"]}


@router.patch("/{match_id}/approve")
async def approve_match(
    match_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_REVIEWERS)),
):
    return await _review(match_id, "approve", supabase, current_user)


@router.patch("/{match_id}/reject")
async def reject_match(
    match_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_REVIEWERS)),
):
    return await _review(match_id, "reject", supabase, current_user)
