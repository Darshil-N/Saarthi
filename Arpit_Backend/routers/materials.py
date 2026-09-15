from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from dependencies import get_supabase, get_current_user, CurrentUser
from services.audit_service import log_action

router = APIRouter()

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
