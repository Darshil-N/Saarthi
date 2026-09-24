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


@router.get("/engineer")
def engineer_dashboard_stats(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Summary stats and lists for the Engineer home dashboard (plan step 5.1.1):
    - totalMaterials / approvedMaterials / pendingMaterials: counts by status
    - totalInventoryLocations: count of bin-level inventory records
    - recentMaterials: 6 most recently added approved materials
    - lowStock: up to 5 materials at or below their own reorder level, from v_low_stock_alerts
      (not just "lowest absolute quantity" — a material with no reorder_level set, or plenty of
      stock relative to its own threshold, should not show up here just because its number is
      small this week).
    """
    try:
        recent = (
            supabase.table("materials")
            .select("id, cnmc, standard_description, status, category, created_at")
            .eq("status", "approved")
            .order("created_at", desc=True)
            .limit(6)
            .execute()
        ).data or []

        low_stock = (
            supabase.table("v_low_stock_alerts")
            .select("material_id, cnmc, standard_description, category, unit_of_measure, "
                    "total_quantity, reorder_level, alert_type")
            .order("total_quantity")
            .limit(5)
            .execute()
        ).data or []

        return {
            "totalMaterials": _count(supabase.table("materials").select("id", count="exact").limit(1)),
            "approvedMaterials": _count(
                supabase.table("materials").select("id", count="exact").eq("status", "approved").limit(1)
            ),
            "pendingMaterials": _count(
                supabase.table("materials").select("id", count="exact").eq("status", "pending").limit(1)
            ),
            "totalInventoryLocations": _count(supabase.table("inventory").select("id", count="exact").limit(1)),
            "recentMaterials": recent,
            "lowStock": low_stock,
        }
    except Exception:
        logger.exception("Could not load engineer dashboard statistics")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Could not load dashboard statistics")
