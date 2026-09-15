from fastapi import APIRouter, Depends
from supabase import Client
from datetime import date
from dependencies import get_supabase, get_current_user, CurrentUser

router = APIRouter()


@router.get("/entry")
async def entry_dashboard_stats(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Returns summary stats for the Entry Operator home dashboard:
    - todayReceipts: number of goods_receipts created today
    - pendingApprovals: number of matching_queue rows with status=pending
    - newMaterialsToday: materials with status=pending created today
    - duplicatesDetected: matching_queue rows with match_type in (exact, duplicate) today
    """
    today = date.today().isoformat()

    try:
        gr_resp = supabase.table("goods_receipts").select("id", count="exact").gte("created_at", today).execute()
        today_receipts = gr_resp.count or 0
    except Exception:
        today_receipts = 0

    try:
        pending_resp = supabase.table("matching_queue").select("id", count="exact").eq("status", "pending").execute()
        pending_approvals = pending_resp.count or 0
    except Exception:
        pending_approvals = 0

    try:
        new_mat_resp = supabase.table("materials").select("id", count="exact").eq("status", "pending").gte("created_at", today).execute()
        new_materials_today = new_mat_resp.count or 0
    except Exception:
        new_materials_today = 0

    try:
        dup_resp = supabase.table("matching_queue").select("id", count="exact").in_("match_type", ["exact", "duplicate"]).gte("created_at", today).execute()
        duplicates_detected = dup_resp.count or 0
    except Exception:
        duplicates_detected = 0

    return {
        "todayReceipts": today_receipts,
        "pendingApprovals": pending_approvals,
        "newMaterialsToday": new_materials_today,
        "duplicatesDetected": duplicates_detected,
    }
