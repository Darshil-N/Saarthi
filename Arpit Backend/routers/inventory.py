from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from dependencies import get_supabase, get_current_user, CurrentUser
from models.inventory import InventoryItem, InventoryAdjustRequest
from services.audit_service import log_action

router = APIRouter()


@router.get("", response_model=list[InventoryItem])
async def list_inventory(
    material_id: str | None = None,
    location_code: str | None = None,
    limit: int = 50,
    offset: int = 0,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = supabase.table("inventory").select(
        "id, material_id, location_code, quantity_on_hand, quantity_reserved, last_receipt_date, updated_at"
    )
    if material_id:
        q = q.eq("material_id", material_id)
    if location_code:
        q = q.eq("location_code", location_code)

    resp = q.range(offset, offset + limit - 1).execute()
    return [InventoryItem(**row) for row in (resp.data or [])]


@router.get("/{inventory_id}", response_model=InventoryItem)
async def get_inventory_item(
    inventory_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    resp = supabase.table("inventory").select("*").eq("id", inventory_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Inventory record not found")
    return InventoryItem(**resp.data)


@router.patch("/{inventory_id}/adjust", response_model=InventoryItem)
async def adjust_inventory(
    inventory_id: str,
    body: InventoryAdjustRequest,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role not in ("entry_operator", "engineer", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    existing = supabase.table("inventory").select("*").eq("id", inventory_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Inventory record not found")

    old_qty = existing.data["quantity_on_hand"]
    new_qty = float(old_qty) + body.quantity_delta

    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot go below 0")

    resp = supabase.table("inventory").update({"quantity_on_hand": new_qty}).eq("id", inventory_id).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Update failed")

    log_action(
        supabase,
        actor_id=current_user.id,
        actor_role=current_user.role,
        action="inventory_updated",
        entity_type="inventory",
        entity_id=inventory_id,
        old_value={"quantity_on_hand": old_qty},
        new_value={"quantity_on_hand": new_qty, "reason": body.reason},
    )
    return InventoryItem(**resp.data[0])
