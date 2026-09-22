import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError
from supabase import Client

from dependencies import CurrentUser, get_current_user, get_supabase, require_roles
from services.validators import require_uuid

logger = logging.getLogger(__name__)

router = APIRouter()

# Plan D-7 (decided 2026-09-22): entry operator, engineer, accounts and admin may all review mappings.
_REVIEWERS = ("entry_operator", "engineer", "accounts", "admin")


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
