import asyncio
import logging
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from supabase import Client

from config import settings
from dependencies import CurrentUser, get_current_user, get_supabase, require_roles
from models.intake import (
    BarcodeRequest,
    ConfirmRequest,
    ConfirmResponse,
    LineItem,
    MatchStatus,
    OCRResponse,
)
from services import receipt_service
from services.ai_common import AIServiceError
from services.audit_service import log_action
from services.cnmc_service import generate_cnmc
from services.matching_service import run_matching
from services.ocr_service import (
    ALLOWED_BILL_TYPES,
    OCRUnreadableError,
    run_ocr,
    signed_bill_url,
    upload_bill_to_storage,
)
from services.validators import require_uuid

logger = logging.getLogger(__name__)

router = APIRouter()

# Only entry operators (and admins, who may act on their behalf) can receive stock.
_ENTRY_ROLES = ("entry_operator", "admin")


# ------------------------------------------------------------------------------ helpers

async def _read_upload(file: UploadFile) -> tuple[bytes, str]:
    """Read an uploaded bill, enforcing the accepted types and the size limit."""
    content_type = (file.content_type or "").lower()
    if content_type == "image/jpg":
        content_type = "image/jpeg"
    if content_type not in ALLOWED_BILL_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Upload a JPG, PNG, WebP image or a PDF.",
        )
    data = await file.read(settings.MAX_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The uploaded file is empty.")
    if len(data) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"The file is too large (limit {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB).",
        )
    return data, content_type


def _insert_pending_material(supabase: Client, material: dict) -> str | None:
    """Insert a pending material, retrying with a numeric CNMC suffix on unique-key collisions."""
    base_cnmc = material.get("cnmc")
    for attempt in range(5):
        try:
            resp = supabase.table("materials").insert(material).execute()
            return resp.data[0]["id"] if resp.data else None
        except Exception as exc:
            if base_cnmc and "materials_cnmc_key" in str(exc) and attempt < 4:
                material["cnmc"] = f"{base_cnmc}-{attempt + 2}"
                continue
            logger.exception("Could not insert pending material %r", material.get("standard_description"))
            return None
    return None


async def _build_line_item(supabase: Client, raw: dict, vendor_id: str | None, user: CurrentUser) -> LineItem:
    """Match one OCR line against the catalog and prepare its draft state.

    Lines the AI is certain about (exact match, high confidence) link straight to the existing
    material. Every other line gets a pending material (plus a review-queue entry when it resembles
    an existing one) so stock can be booked against it and an approver can decide later.
    """
    description = raw["description"]
    quantity = raw["quantity"]
    unit_price = raw["unit_price"]

    match = await run_matching(supabase, description, incoming_specs=raw)
    matched_id = match["matched_material_id"]
    candidate = match["master_candidate"]

    try:
        match_status = MatchStatus(match["match_status"])
    except ValueError:
        match_status = MatchStatus.uncertain

    cnmc = match["cnmc"] if match["auto_link"] else None
    pending_id: str | None = None

    if not match["auto_link"]:
        if candidate is None:
            cnmc_data = await generate_cnmc(supabase, description, str(raw), raw.get("quality_grade") or "")
            generated = True
        else:
            # A near-duplicate or uncertain line mirrors the catalog entry it resembles.
            cnmc_data = {
                "cnmc": candidate.get("cnmc"),
                "category": candidate.get("category") or "MISC",
                "subcategory": candidate.get("subcategory") or "GEN",
                "type": candidate.get("material_type") or "GEN",
                "spec": candidate.get("spec"),
                "quality": candidate.get("quality_grade"),
                "standard_description": candidate.get("standard_description") or description,
                "short_description": candidate.get("short_description"),
                "technical_specs": candidate.get("technical_specs"),
            }
            generated = False

        pending_material = {
            "cnmc": cnmc_data.get("cnmc"),
            "category": cnmc_data.get("category") or "MISC",
            "subcategory": cnmc_data.get("subcategory") or "GEN",
            "material_type": cnmc_data.get("type") or "GEN",
            "spec": cnmc_data.get("spec"),
            "quality_grade": cnmc_data.get("quality") if cnmc_data.get("quality") in ("A", "B", "C") else "A",
            "standard_description": cnmc_data.get("standard_description") or description,
            "short_description": cnmc_data.get("short_description"),
            "technical_specs": cnmc_data.get("technical_specs"),
            "status": "pending",
            "embedding": match["embedding"],
            "created_by": user.id,
            "unit_of_measure": raw["unit"],
        }
        pending_id = await asyncio.to_thread(_insert_pending_material, supabase, pending_material)
        cnmc = pending_material.get("cnmc")

        if pending_id and generated:
            await asyncio.to_thread(
                log_action, supabase, user.id, user.role, "cnmc_generated", "materials", pending_id, None, {"cnmc": cnmc}
            )

        # matching_queue.matched_material_id is NOT NULL, so only lines that resemble something are queued.
        if pending_id and matched_id:
            queue_row = {
                "new_material_id": pending_id,
                "matched_material_id": matched_id,
                "match_type": match["match_type"],
                "confidence_score": match["confidence"],
                "vector_similarity": match["vector_similarity"],
                "match_reason": match["match_reason"],
                "status": "pending",
            }
            try:
                await asyncio.to_thread(lambda: supabase.table("matching_queue").insert(queue_row).execute())
            except Exception:
                logger.exception("Could not queue %s for review", pending_id)

    return LineItem(
        line_id=raw["line_id"],
        description=description,
        quantity=quantity,
        unit=raw["unit"],
        unit_price=unit_price,
        total_price=round(quantity * unit_price, 4),
        batch_number=raw.get("batch_number"),
        hsn_code=raw.get("hsn_code"),
        match_status=match_status,
        matched_material_id=matched_id,
        matched_description=match["matched_description"],
        pending_material_id=pending_id,
        confidence=match["confidence"],
        match_reason=match["match_reason"],
        cnmc=cnmc,
        is_new_material=match_status == MatchStatus.new_material,
        quality_grade=raw.get("quality_grade") or "A",
        quality_notes="",
        vendor_id=vendor_id,
    )


# ------------------------------------------------------------------------------ endpoints

@router.post("/ocr", response_model=OCRResponse)
async def intake_ocr(
    file: UploadFile = File(...),
    vendor_id: Optional[str] = Form(None),
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_ENTRY_ROLES)),
):
    file_bytes, content_type = await _read_upload(file)

    try:
        raw_items = await run_ocr(file_bytes, content_type)
    except OCRUnreadableError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not find any line items on this bill. Try a clearer photo or a PDF.",
        )
    except AIServiceError as exc:
        raise HTTPException(exc.status_code, detail=exc.user_message)

    bill_path = await upload_bill_to_storage(supabase, file_bytes, content_type)

    # Lines are processed one at a time on purpose: it keeps bursts of Gemini calls within
    # the free-tier rate limit.
    line_items = [await _build_line_item(supabase, raw, vendor_id, current_user) for raw in raw_items]

    return OCRResponse(
        receipt_id=f"draft-{uuid.uuid4()}",
        line_items=line_items,
        bill_image_url=await asyncio.to_thread(signed_bill_url, supabase, bill_path),
        bill_image_path=bill_path,
    )


@router.post("/barcode")
def intake_barcode(
    body: BarcodeRequest,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_ENTRY_ROLES)),
):
    code = body.code.strip()
    if not code:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The barcode is empty.")

    material_id = None
    # 1. Legacy code mappings first (CNMC + legacy code lookup)
    mapping = (
        supabase.table("material_code_mappings").select("material_id").eq("legacy_code", code).limit(1).execute()
    )
    if mapping.data:
        material_id = mapping.data[0]["material_id"]

    # 2. Fall back to a direct CNMC match
    if not material_id:
        by_cnmc = supabase.table("materials").select("id").eq("cnmc", code).limit(1).execute()
        if by_cnmc.data:
            material_id = by_cnmc.data[0]["id"]

    if not material_id:
        return {"found": False, "barcode": code}

    mat = (
        supabase.table("materials")
        .select("id, cnmc, standard_description, unit_of_measure, quality_grade")
        .eq("id", material_id)
        .maybe_single()
        .execute()
    )
    if not mat or not mat.data:
        return {"found": False, "barcode": code}
    material = mat.data

    price = (
        supabase.table("price_history")
        .select("unit_price")
        .eq("material_id", material_id)
        .order("purchase_date", desc=True)
        .limit(1)
        .execute()
    )
    last_price = price.data[0]["unit_price"] if price.data else 0.0

    return {
        "found": True,
        "barcode": code,
        "matched_material_id": material["id"],
        "cnmc": material["cnmc"],
        "description": material["standard_description"],
        "unit": material.get("unit_of_measure") or "EA",
        "unit_price": last_price,
        "quality_grade": material.get("quality_grade") or "",
        "match_status": "exact_match",
        "is_new_material": False,
        "confidence": 1.0,
    }


def _optional_filter(value: Optional[str]) -> Optional[str]:
    """The UI sends 'all' or an empty string for 'no filter'."""
    value = (value or "").strip()
    return None if value in ("", "all") else value


def _optional_date(value: Optional[str], name: str) -> Optional[date]:
    value = _optional_filter(value)
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{name} must be a date like 2026-09-19")


@router.get("/receipts")
def get_receipts(
    vendor_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    vendor = _optional_filter(vendor_id)
    return receipt_service.list_receipts(
        supabase,
        vendor_id=require_uuid(vendor, "Vendor") if vendor else None,
        receipt_status=_optional_filter(status_filter),
        from_date=_optional_date(from_date, "from_date"),
        to_date=_optional_date(to_date, "to_date"),
        limit=limit,
        offset=offset,
    )


@router.get("/receipts/{receipt_id}")
def get_receipt(
    receipt_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    detail = receipt_service.get_receipt_detail(supabase, require_uuid(receipt_id, "Receipt"))
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    return detail


@router.post("/confirm", response_model=ConfirmResponse)
def confirm_receipt(
    body: ConfirmRequest,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(require_roles(*_ENTRY_ROLES)),
):
    result = receipt_service.confirm_receipt(supabase, current_user, body)
    return ConfirmResponse(status="success", **result)
