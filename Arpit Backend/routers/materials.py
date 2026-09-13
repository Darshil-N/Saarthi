from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from dependencies import get_supabase, get_current_user, CurrentUser
from models.materials import MaterialOut, MaterialApproveRequest, MaterialStatus
from services.audit_service import log_action

router = APIRouter()


@router.get("", response_model=list[MaterialOut])
async def list_materials(
    status_filter: str | None = None,
    category: str | None = None,
    subcategory: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = supabase.table("materials").select(
        "id, cnmc, category, subcategory, type, spec, quality, "
        "standard_description, short_description, uom, hsn_code, "
        "quality_grade, status, created_at, updated_at"
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
    return [MaterialOut(**m) for m in (resp.data or [])]


@router.get("/{material_id}", response_model=MaterialOut)
async def get_material(
    material_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    resp = supabase.table("materials").select("*").eq("id", material_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Material not found")
    return MaterialOut(**resp.data)


@router.patch("/{material_id}/approve", response_model=MaterialOut)
async def approve_material(
    material_id: str,
    body: MaterialApproveRequest,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role not in ("admin", "entry_operator", "engineer"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Fetch current state
    existing = supabase.table("materials").select("*").eq("id", material_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Material not found")

    old_status = existing.data.get("status")
    if old_status == "approved" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can modify approved materials")

    new_status = "approved" if body.approved else "deprecated"
    from datetime import datetime, timezone
    update_data: dict = {"status": new_status}
    if new_status == "approved":
        update_data["approved_by"] = current_user.id
        update_data["approved_at"] = datetime.now(timezone.utc).isoformat()

    resp = supabase.table("materials").update(update_data).eq("id", material_id).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Update failed")

    log_action(
        supabase,
        actor_id=current_user.id,
        actor_role=current_user.role,
        action="material_approved" if new_status == "approved" else "material_deprecated",
        entity_type="materials",
        entity_id=material_id,
        old_value={"status": old_status},
        new_value={"status": new_status},
    )
    return MaterialOut(**resp.data[0])
