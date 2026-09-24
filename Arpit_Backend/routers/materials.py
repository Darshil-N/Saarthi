import logging
import re
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client
from dependencies import get_supabase, get_current_user, require_roles, CurrentUser
from services.audit_service import log_action
from services.validators import require_uuid

logger = logging.getLogger(__name__)

router = APIRouter()

# Plan D-7 (decided 2026-09-22): entry operator, engineer, accounts and admin may all approve
# materials, matching matching.py's _REVIEWERS. This was missed when D-7 was first applied —
# approve_material below still had the pre-D-7 role list until 2026-09-24.
_GOVERNANCE_ROLES = ("entry_operator", "engineer", "accounts", "admin")


class NLQueryRequest(BaseModel):
    query: str


class MaterialEditRequest(BaseModel):
    standard_description: Optional[str] = Field(default=None, min_length=1, max_length=500)
    short_description: Optional[str] = Field(default=None, max_length=200)


class BulkActionRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=200)
    action: str  # "approve" | "deprecate"


class DeprecateRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


STOPWORDS = {"the", "a", "an", "is", "are", "of", "in", "to", "how", "many",
             "what", "where", "which", "show", "list", "all", "do", "we",
             "have", "with", "and", "below", "stock", "for", "me", "stored",
             "store", "storage", "item", "items", "material", "materials",
             "much", "there", "any", "us", "does", "our", "at", "on", "by"}

# crude singular/plural normalization so "bolts" still matches stored "bolt"
def _singularize(word: str) -> str:
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"
    if word.endswith("es") and len(word) > 4:
        return word[:-2]
    if word.endswith("s") and not word.endswith("ss") and len(word) > 3:
        return word[:-1]
    return word


@router.post("/nl-query")
def nl_query(
    body: NLQueryRequest,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Lightweight NL->data lookup against the real live catalog. Not a general
    NL->SQL engine (no raw SQL execution is available via the Supabase REST
    API without a direct Postgres connection) -- instead it keyword-matches
    the question against the same v_inventory_full / v_low_stock_alerts
    views the plan calls for, and returns real rows plus a representative
    SQL string for display.
    """
    q = body.query.strip()
    ql = q.lower()

    low_stock = any(w in ql for w in ("below reorder", "low stock", "reorder", "running low", "short"))
    warehouse_match = re.search(r"whse-[abc]|warehouse\s*([abc])", ql)
    warehouse = None
    if warehouse_match:
        letter = warehouse_match.group(1) or warehouse_match.group(0)[-1]
        warehouse = f"WHSE-{letter.upper()}"

    category = None
    for word, cat in (("mechanical", "MECH"), ("electrical", "ELEC"), ("chemical", "CHEM"),
                       ("consumable", "CONS"), ("civil", "CIVIL")):
        if word in ql:
            category = cat
            break

    # "below/less than/under N" -> numeric threshold on available quantity
    qty_threshold = None
    qty_match = re.search(r"(?:below|less than|under|fewer than)\s+(\d+)", ql)
    if qty_match:
        qty_threshold = int(qty_match.group(1))

    skip_words = {"whse", "warehouse", "a", "b", "c"} if warehouse else set()
    if category:
        skip_words |= {"mechanical", "electrical", "chemical", "consumable", "civil", "materials", "material"}
    keywords = [_singularize(w) for w in re.findall(r"[a-z0-9]+", ql)
                if w not in STOPWORDS and w not in skip_words and len(w) > 1
                and not (qty_threshold is not None and w.isdigit())]

    if low_stock:
        query = supabase.table("v_low_stock_alerts").select("*").limit(50)
        sql_display = "SELECT * FROM v_low_stock_alerts;"
        explanation = "Materials at or below their reorder level."
    else:
        query = supabase.table("v_inventory_full").select("*").limit(50)
        sql_display = "SELECT * FROM v_inventory_full"
        conditions = []
        if warehouse:
            query = query.eq("warehouse", warehouse)
            conditions.append(f"warehouse = '{warehouse}'")
        if category:
            query = query.eq("category", category)
            conditions.append(f"category = '{category}'")
        if qty_threshold is not None:
            query = query.lt("available_quantity", qty_threshold)
            conditions.append(f"available_quantity < {qty_threshold}")
        if keywords:
            or_clause = ",".join(f"standard_description.ilike.%{kw}%" for kw in keywords[:5])
            query = query.or_(or_clause)
            conditions.append(" OR ".join(f"standard_description ILIKE '%{kw}%'" for kw in keywords[:5]))
        if conditions:
            sql_display += " WHERE " + " AND ".join(f"({c})" if " OR " in c else c for c in conditions)
        sql_display += ";"
        explanation = "Live inventory joined with material and location details, filtered by the terms in your question."

    def _log(was_successful: bool, result_count: int, error: Optional[str] = None) -> None:
        try:
            supabase.table("nl_query_log").insert({
                "user_id": current_user.id,
                "natural_language_query": q,
                "generated_sql": sql_display,
                "sql_explanation": explanation,
                "query_result_count": result_count,
                "was_successful": was_successful,
                "error_message": error,
            }).execute()
        except Exception:
            logger.warning("Could not write nl_query_log entry", exc_info=True)

    try:
        results = query.execute().data or []
    except Exception as exc:
        logger.exception("NL query failed: %r", q)
        _log(False, 0, str(exc)[:500])
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="The query could not be run. Please try again.")

    _log(True, len(results))

    return {
        "sql": sql_display,
        "explanation": explanation,
        "results": results,
        "result_count": len(results),
    }

def _filtered_materials(
    supabase: Client,
    status_filter: Optional[str],
    category: Optional[str],
    subcategory: Optional[str],
    search: Optional[str],
    *,
    count: str | None = None,
):
    q = supabase.table("materials").select(
        "id,cnmc,category,subcategory,material_type,spec,quality_grade,"
        "standard_description,short_description,unit_of_measure,status,"
        "created_at,updated_at",
        count=count,
    )
    if status_filter:
        q = q.eq("status", status_filter)
    if category:
        q = q.eq("category", category)
    if subcategory:
        q = q.eq("subcategory", subcategory)
    if search:
        q = q.or_(f"standard_description.ilike.%{search}%,cnmc.ilike.%{search}%")
    return q


@router.get("")
def list_materials(
    status_filter: Optional[str] = None,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = _filtered_materials(supabase, status_filter, category, subcategory, search)
    resp = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return resp.data or []


@router.get("/count")
def count_materials(
    status_filter: Optional[str] = None,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    search: Optional[str] = None,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Total matching a filter, for pagination (Material Catalog — plan step 5.1.6/5.1.7)."""
    q = _filtered_materials(supabase, status_filter, category, subcategory, search, count="exact")
    return {"total": q.limit(1).execute().count or 0}


@router.get("/{material_id}")
def get_material(
    material_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    resp = supabase.table("materials").select("*").eq("id", require_uuid(material_id, "Material")).maybe_single().execute()
    if not resp or not resp.data:
        raise HTTPException(status_code=404, detail="Material not found")
    return resp.data

@router.patch("/{material_id}/approve")
def approve_material(
    material_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_GOVERNANCE_ROLES)),
):
    material_id = require_uuid(material_id, "Material")
    existing = supabase.table("materials").select("*").eq("id", material_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Material not found")
    old_status = existing.data.get("status")
    now = datetime.now(timezone.utc).isoformat()
    resp = supabase.table("materials").update({
        "status": "approved",
        "approved_by": current_user.id,
        "approved_at": now,
    }).eq("id", material_id).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Update failed")
    log_action(supabase, current_user.id, current_user.role,
               "material_approved","materials", material_id,
               {"status": old_status}, {"status": "approved"})
    return resp.data[0]


@router.patch("/{material_id}/deprecate")
def deprecate_material(
    material_id: str,
    body: DeprecateRequest = DeprecateRequest(),
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_GOVERNANCE_ROLES)),
):
    """Plan step 7.1.1 — material governance: deprecate."""
    material_id = require_uuid(material_id, "Material")
    existing = supabase.table("materials").select("id, status").eq("id", material_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Material not found")
    old_status = existing.data.get("status")
    now = datetime.now(timezone.utc).isoformat()
    resp = supabase.table("materials").update({
        "status": "deprecated",
        "deprecated_by": current_user.id,
        "deprecated_at": now,
        "deprecation_reason": body.reason,
    }).eq("id", material_id).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Update failed")
    log_action(supabase, current_user.id, current_user.role,
               "material_deprecated", "materials", material_id,
               {"status": old_status}, {"status": "deprecated", "reason": body.reason})
    return resp.data[0]


@router.patch("")
def bulk_material_action(
    body: BulkActionRequest,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_GOVERNANCE_ROLES)),
):
    """Plan step 7.1.1 — bulk approve/deprecate. Applies to every id that exists; ids that don't
    exist are silently skipped and reported back rather than failing the whole batch."""
    if body.action not in ("approve", "deprecate"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="action must be approve or deprecate")

    ids = [require_uuid(i, "Material") for i in body.ids]
    existing = supabase.table("materials").select("id, status").in_("id", ids).execute().data or []
    found_ids = [row["id"] for row in existing]
    now = datetime.now(timezone.utc).isoformat()

    if body.action == "approve":
        payload = {"status": "approved", "approved_by": current_user.id, "approved_at": now}
        action_name = "material_approved"
    else:
        payload = {"status": "deprecated", "deprecated_by": current_user.id, "deprecated_at": now}
        action_name = "material_deprecated"

    updated: list[dict] = []
    for row in existing:
        resp = supabase.table("materials").update(payload).eq("id", row["id"]).execute()
        if resp.data:
            updated.append(resp.data[0])
            log_action(supabase, current_user.id, current_user.role, action_name, "materials",
                       row["id"], {"status": row["status"]}, {"status": payload["status"]})

    return {
        "requested": len(ids),
        "updated": len(updated),
        "not_found": [i for i in ids if i not in found_ids],
    }


@router.patch("/{material_id}")
def edit_material(
    material_id: str,
    body: MaterialEditRequest,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_GOVERNANCE_ROLES)),
):
    """Plan step 7.1.1 — edit a material's description. Deliberately narrow: cnmc, category and
    quality fields are not editable here (they drive the classification/matching logic)."""
    material_id = require_uuid(material_id, "Material")
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    if not changes:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Nothing to update")

    existing = supabase.table("materials").select("id, standard_description, short_description") \
        .eq("id", material_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Material not found")

    old_values = {k: existing.data.get(k) for k in changes}
    resp = supabase.table("materials").update(changes).eq("id", material_id).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Update failed")
    log_action(supabase, current_user.id, current_user.role, "material_edited", "materials",
               material_id, old_values, changes)
    return resp.data[0]


@router.get("/{material_id}/equivalents")
def material_equivalents(
    material_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Materials confirmed equivalent to this one (approved matches, plan step 5.1.9) — checked
    both directions, since a match can point either way depending on which line was matched
    against which candidate at confirm time."""
    material_id = require_uuid(material_id, "Material")
    as_new = supabase.table("v_matching_queue_detailed").select("*") \
        .eq("new_material_id", material_id).eq("status", "approved").execute().data or []
    as_matched = supabase.table("v_matching_queue_detailed").select("*") \
        .eq("matched_material_id", material_id).eq("status", "approved").execute().data or []

    equivalents = [
        {"id": r["matched_material_id"], "cnmc": r["matched_cnmc"], "standard_description": r["matched_description"]}
        for r in as_new
    ] + [
        {"id": r["new_material_id"], "cnmc": r["new_cnmc"], "standard_description": r["new_description"]}
        for r in as_matched
    ]
    seen: set[str] = set()
    deduped = []
    for eq in equivalents:
        if eq["id"] not in seen:
            seen.add(eq["id"])
            deduped.append(eq)
    return deduped
