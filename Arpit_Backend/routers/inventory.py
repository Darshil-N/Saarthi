from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from dependencies import CurrentUser, get_current_user, get_supabase
from services.validators import require_uuid

router = APIRouter()


@router.get("")
def list_inventory(
    material_id: Optional[str] = None,
    location_code: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = supabase.table("inventory").select(
        "id,material_id,location_code,quantity,reserved_quantity,reorder_level,last_movement_at,last_updated"
    )
    if material_id:
        q = q.eq("material_id", require_uuid(material_id, "Material"))
    if location_code:
        q = q.eq("location_code", location_code)
    resp = q.order("last_updated", desc=True).range(offset, offset + limit - 1).execute()
    return resp.data or []


@router.get("/locations")
def list_locations(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    resp = (
        supabase.table("locations")
        .select("code, warehouse, aisle, rack, bin")
        .eq("is_active", True)
        .order("code")
        .execute()
    )
    return resp.data or []


@router.get("/map")
def inventory_map(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Every active location, plus whatever is stored there — including bins with no stock at
    all, which the inventory table has no row for (plan step 5.1.3). One entry per
    (location, material) pair; a location with several materials in it appears more than once,
    a genuinely empty location appears once with material_id null."""
    locations = (
        supabase.table("locations")
        .select("code, warehouse, aisle, rack, bin")
        .eq("is_active", True)
        .execute()
    ).data or []
    inv = (
        supabase.table("inventory")
        .select(
            "id,material_id,location_code,quantity,reserved_quantity,reorder_level,max_stock,"
            "last_movement_at,materials(cnmc,standard_description,short_description,unit_of_measure,category)"
        )
        .execute()
    ).data or []

    by_location: dict[str, list[dict]] = {}
    for row in inv:
        by_location.setdefault(row["location_code"], []).append(row)

    result = []
    for loc in locations:
        rows = by_location.get(loc["code"])
        if not rows:
            result.append({
                "location_code": loc["code"], "warehouse": loc.get("warehouse"), "aisle": loc.get("aisle"),
                "rack": loc.get("rack"), "bin": loc.get("bin"), "material_id": None, "cnmc": None,
                "standard_description": None, "short_description": None, "unit_of_measure": None,
                "category": None, "quantity": 0, "reserved_quantity": 0, "reorder_level": None,
                "max_stock": None, "last_movement_at": None,
            })
            continue
        for r in rows:
            m = r.get("materials") or {}
            result.append({
                "location_code": loc["code"], "warehouse": loc.get("warehouse"), "aisle": loc.get("aisle"),
                "rack": loc.get("rack"), "bin": loc.get("bin"), "material_id": r["material_id"],
                "cnmc": m.get("cnmc"), "standard_description": m.get("standard_description"),
                "short_description": m.get("short_description"), "unit_of_measure": m.get("unit_of_measure"),
                "category": m.get("category"), "quantity": r.get("quantity") or 0,
                "reserved_quantity": r.get("reserved_quantity") or 0,
                "reorder_level": r.get("reorder_level"), "max_stock": r.get("max_stock"),
                "last_movement_at": r.get("last_movement_at"),
            })
    return result


@router.get("/{inventory_id}")
def get_inventory_item(
    inventory_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    resp = (
        supabase.table("inventory")
        .select("*")
        .eq("id", require_uuid(inventory_id, "Inventory item"))
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return resp.data
