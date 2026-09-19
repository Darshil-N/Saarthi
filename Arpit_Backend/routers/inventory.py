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
