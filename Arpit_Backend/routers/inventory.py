from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from dependencies import get_supabase, get_current_user, CurrentUser
from services.audit_service import log_action

router = APIRouter()

@router.get("")
async def list_inventory(
    material_id: str = None,
    location_code: str = None,
    limit: int = 50,
    offset: int = 0,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = supabase.table("inventory").select(
        "id,material_id,location_code,quantity,reserved_quantity,reorder_level,last_movement_at,last_updated"
    )
    if material_id:
        q = q.eq("material_id", material_id)
    if location_code:
        q = q.eq("location_code", location_code)
    resp = q.range(offset, offset + limit - 1).execute()
    return resp.data or []

@router.get("/locations")
async def list_locations(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    resp = supabase.table("locations").select("code, warehouse, aisle, rack, bin").eq("is_active", True).execute()
    return resp.data or []

@router.get("/{inventory_id}")
async def get_inventory_item(
    inventory_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    resp = supabase.table("inventory").select("*").eq("id", inventory_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return resp.data

