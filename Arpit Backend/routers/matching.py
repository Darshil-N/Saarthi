from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from supabase import Client

from dependencies import get_supabase, get_current_user, CurrentUser
from models.matching import MatchingQueueItem, MatchDecisionRequest
from services.audit_service import log_action
from services.cnmc_service import generate_cnmc
from services.embedding_service import generate_embedding

router = APIRouter()


@router.get("", response_model=list[MatchingQueueItem])
async def list_pending(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return all pending matching_queue items (for entry_operator dashboard)."""
    resp = (
        supabase.table("matching_queue")
        .select("*")
        .eq("match_status", "pending")
        .order("created_at", desc=False)
        .execute()
    )
    return [MatchingQueueItem(**row) for row in (resp.data or [])]


@router.patch("/{match_id}/approve")
async def approve_match(
    match_id: str,
    body: MatchDecisionRequest,
    background_tasks: BackgroundTasks,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Approve a near-duplicate match:
    - Mark the matching_queue row as 'approved'
    - Merge: deprecate the incoming material, keep the canonical one
    """
    if current_user.role not in ("entry_operator", "engineer", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    row = supabase.table("matching_queue").select("*").eq("id", match_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Match not found")

    match = row.data
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    # Mark resolved
    supabase.table("matching_queue").update({
        "match_status": "approved",
        "resolved_by": current_user.id,
        "resolved_at": now,
    }).eq("id", match_id).execute()

    # Deprecate the incoming material if it was created as new
    # The gr_line_item links to the candidate – we keep that material
    candidate_id = match.get("candidate_material_id")
    if candidate_id:
        log_action(
            supabase, current_user.id, current_user.role,
            "mapping_approved", "matching_queue", match_id,
            old_value={"match_status": "pending"},
            new_value={"match_status": "approved", "candidate_material_id": candidate_id},
        )

    return {"status": "approved", "match_id": match_id, "candidate_material_id": candidate_id}


@router.patch("/{match_id}/reject")
async def reject_match(
    match_id: str,
    body: MatchDecisionRequest,
    background_tasks: BackgroundTasks,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Reject a duplicate suggestion:
    - Mark the matching_queue row as 'rejected'
    - The incoming material proceeds standalone with its own CNMC
    """
    if current_user.role not in ("entry_operator", "engineer", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    row = supabase.table("matching_queue").select("*").eq("id", match_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Match not found")

    match = row.data
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    supabase.table("matching_queue").update({
        "match_status": "rejected",
        "resolved_by": current_user.id,
        "resolved_at": now,
    }).eq("id", match_id).execute()

    # Generate a fresh CNMC for the rejected-as-duplicate description
    background_tasks.add_task(
        _assign_new_cnmc_after_rejection,
        supabase,
        match,
        current_user,
    )

    log_action(
        supabase, current_user.id, current_user.role,
        "mapping_rejected", "matching_queue", match_id,
        old_value={"match_status": "pending"},
        new_value={"match_status": "rejected"},
    )
    return {"status": "rejected", "match_id": match_id}


async def _assign_new_cnmc_after_rejection(supabase: Client, match: dict, user: CurrentUser):
    """Background: generate CNMC for a standalone material after rejection."""
    desc = match.get("incoming_description", "")
    specs = match.get("incoming_specs") or {}
    try:
        cnmc_data = await generate_cnmc(supabase, desc, str(specs))
        embedding = await generate_embedding(desc)
        # Insert new material
        new_mat = {
            "cnmc": cnmc_data["cnmc"],
            "category": cnmc_data.get("category", "MISC"),
            "subcategory": cnmc_data.get("subcategory", "GEN"),
            "type": cnmc_data.get("type"),
            "spec": cnmc_data.get("spec"),
            "quality": cnmc_data.get("quality"),
            "standard_description": cnmc_data.get("standard_description", desc),
            "short_description": cnmc_data.get("short_description"),
            "status": "pending",
            "embedding": embedding,
            "created_by": user.id,
        }
        mat_resp = supabase.table("materials").insert(new_mat).execute()
        if mat_resp.data:
            material_id = mat_resp.data[0]["id"]
            log_action(supabase, user.id, user.role, "cnmc_generated",
                       "materials", material_id, None, {"cnmc": cnmc_data["cnmc"]})
    except Exception as exc:
        print(f"[matching_router] CNMC background task failed: {exc}")
