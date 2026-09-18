from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from supabase import Client
from dependencies import get_supabase, get_current_user, CurrentUser
from services.audit_service import log_action

router = APIRouter()

@router.get("")
async def list_pending(
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

@router.patch("/{match_id}/approve")
async def approve_match(
    match_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role not in ("entry_operator","engineer","admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    row = supabase.table("matching_queue").select("*").eq("id", match_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Match not found")
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("matching_queue").update({
        "status": "approved",
        "reviewed_by": current_user.id,
        "reviewed_at": now,
    }).eq("id", match_id).execute()
    log_action(supabase, current_user.id, current_user.role, "mapping_approved",
               "matching_queue", match_id, {"status":"pending"}, {"status":"approved"})
    return {"status":"approved","match_id": match_id}

@router.patch("/{match_id}/reject")
async def reject_match(
    match_id: str,
    background_tasks: BackgroundTasks,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role not in ("entry_operator","engineer","admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    row = supabase.table("matching_queue").select("*").eq("id", match_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Match not found")
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("matching_queue").update({
        "status": "rejected",
        "reviewed_by": current_user.id,
        "reviewed_at": now,
    }).eq("id", match_id).execute()
    log_action(supabase, current_user.id, current_user.role, "mapping_rejected",
               "matching_queue", match_id, {"status":"pending"}, {"status":"rejected"})
    return {"status":"rejected","match_id": match_id}
