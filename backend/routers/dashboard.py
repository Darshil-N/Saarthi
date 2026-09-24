import logging
import time

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from config import settings
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


@router.get("/admin")
def admin_dashboard_stats(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Summary stats for the Admin home dashboard (plan step 7.4.4):
    - total / approved / pending: material counts by status
    - duplicates: all-time matching_queue row count (every match ever detected, not just pending)
    - qualityScore: % of approved materials (sampled up to 500) with a non-empty technical_specs
    - recentMaterials: 5 most recently added materials, any status
    """
    try:
        specs_sample = (
            supabase.table("materials").select("technical_specs").eq("status", "approved").limit(500).execute()
        ).data or []
        with_specs = sum(1 for m in specs_sample if m.get("technical_specs"))
        quality_score = round((with_specs / len(specs_sample)) * 100) if specs_sample else 0

        recent = (
            supabase.table("materials")
            .select("id, cnmc, standard_description, status, created_at")
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        ).data or []

        return {
            "total": _count(supabase.table("materials").select("id", count="exact").limit(1)),
            "approved": _count(
                supabase.table("materials").select("id", count="exact").eq("status", "approved").limit(1)
            ),
            "pending": _count(
                supabase.table("materials").select("id", count="exact").eq("status", "pending").limit(1)
            ),
            "duplicates": _count(supabase.table("matching_queue").select("id", count="exact").limit(1)),
            "qualityScore": quality_score,
            "recentMaterials": recent,
        }
    except Exception:
        logger.exception("Could not load admin dashboard statistics")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Could not load dashboard statistics")


@router.get("/system-health")
def system_health_stats(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Real system health for the Admin System Health screen (plan step 7.4.3).
    Unlike the other dashboard endpoints, a database failure here is reported as data
    (dbConnected: false) rather than a 502 — the whole point of a health screen is to show what's
    actually broken, not to itself error out when the thing it is checking is down.
    geminiConfigured only checks that an API key is set; it does not make a live Gemini call on
    every page load, since that would be slow (per the free-tier latency already observed live)
    and would burn quota for no real benefit on a page that just wants a status light.
    """
    start = time.monotonic()
    try:
        materials = _count(supabase.table("materials").select("id", count="exact").limit(1))
        db_ping_ms = round((time.monotonic() - start) * 1000)
        return {
            "dbConnected": True,
            "dbPingMs": db_ping_ms,
            "geminiConfigured": bool(settings.GEMINI_API_KEY),
            "counts": {
                "materials": materials,
                "goodsReceipts": _count(supabase.table("goods_receipts").select("id", count="exact").limit(1)),
                "auditEntries": _count(supabase.table("audit_log").select("id", count="exact").limit(1)),
                "matchingQueue": _count(supabase.table("matching_queue").select("id", count="exact").limit(1)),
                "nlQueries": _count(supabase.table("nl_query_log").select("id", count="exact").limit(1)),
            },
        }
    except Exception:
        logger.exception("System health check found the database unreachable")
        return {
            "dbConnected": False,
            "dbPingMs": None,
            "geminiConfigured": bool(settings.GEMINI_API_KEY),
            "counts": None,
        }
