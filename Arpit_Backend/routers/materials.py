import re
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from dependencies import get_supabase, get_current_user, CurrentUser
from services.audit_service import log_action

router = APIRouter()


class NLQueryRequest(BaseModel):
    query: str


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
async def nl_query(
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

    resp = query.execute()
    results = resp.data or []

    try:
        supabase.table("nl_query_log").insert({
            "user_id": current_user.id,
            "natural_language_query": q,
            "generated_sql": sql_display,
            "sql_explanation": explanation,
            "query_result_count": len(results),
            "was_successful": True,
        }).execute()
    except Exception:
        pass

    return {
        "sql": sql_display,
        "explanation": explanation,
        "results": results,
        "result_count": len(results),
    }

@router.get("")
async def list_materials(
    status_filter: str = None,
    category: str = None,
    subcategory: str = None,
    search: str = None,
    limit: int = 50,
    offset: int = 0,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = supabase.table("materials").select(
        "id,cnmc,category,subcategory,material_type,spec,quality_grade,"
        "standard_description,short_description,unit_of_measure,status,"
        "created_at,updated_at"
    )
    if status_filter:
        q = q.eq("status", status_filter)
    if category:
        q = q.eq("category", category)
    if subcategory:
        q = q.eq("subcategory", subcategory)
    if search:
        q = q.ilike("standard_description", f"%{search}%")
    resp = q.range(offset, offset + limit - 1).execute()
    return resp.data or []

@router.get("/{material_id}")
async def get_material(
    material_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    resp = supabase.table("materials").select("*").eq("id", material_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Material not found")
    return resp.data

@router.patch("/{material_id}/approve")
async def approve_material(
    material_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role not in ("admin","entry_operator","engineer"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    existing = supabase.table("materials").select("*").eq("id", material_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Material not found")
    old_status = existing.data.get("status")
    from datetime import datetime, timezone
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
