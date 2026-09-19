import logging

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from dependencies import CurrentUser, get_current_user, get_supabase
from services.time_utils import business_day_start_utc

logger = logging.getLogger(__name__)

router = APIRouter()


def _count(query) -> int:
    return query.execute().count or 0


@router.get("/entry")
def entry_dashboard_stats(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Summary stats for the Entry Operator home dashboard ("today" is the business day, not UTC):
    - todayReceipts: goods_receipts created today
    - pendingApprovals: matching_queue rows with status=pending
    - newMaterialsToday: pending materials created today
    - duplicatesDetected: matching_queue rows with match_type in (exact, duplicate) created today
    """
    today_start = business_day_start_utc().isoformat()

    try:
        return {
            "todayReceipts": _count(
                supabase.table("goods_receipts").select("id", count="exact").gte("created_at", today_start).limit(1)
            ),
            "pendingApprovals": _count(
                supabase.table("matching_queue").select("id", count="exact").eq("status", "pending").limit(1)
            ),
            "newMaterialsToday": _count(
                supabase.table("materials")
                .select("id", count="exact")
                .eq("status", "pending")
                .gte("created_at", today_start)
                .limit(1)
            ),
            "duplicatesDetected": _count(
                supabase.table("matching_queue")
                .select("id", count="exact")
                .in_("match_type", ["exact", "duplicate"])
                .gte("created_at", today_start)
                .limit(1)
            ),
        }
    except Exception:
        logger.exception("Could not load entry dashboard statistics")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Could not load dashboard statistics")
