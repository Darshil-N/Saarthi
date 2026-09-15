from fastapi import APIRouter, Depends
from supabase import Client
from dependencies import get_supabase, get_current_user, CurrentUser

router = APIRouter()

@router.get("")
async def list_vendors(
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    resp = supabase.table("vendors").select(
        "id, name, code, contact_person, phone, email, gstin, rating, is_active"
    ).eq("is_active", True).order("name").execute()
    return resp.data or []
