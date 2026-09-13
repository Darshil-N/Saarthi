import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from supabase import Client

from dependencies import get_supabase, get_current_user, CurrentUser
from models.intake import OCRResponse, LineItem, MatchStatus, ConfirmRequest, ConfirmResponse, BarcodeRequest
from services.ocr_service import upload_bill_to_storage, run_ocr
from services.matching_service import run_matching
from services.cnmc_service import generate_cnmc
from services.embedding_service import generate_embedding
from services.audit_service import log_action

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: build a LineItem from raw OCR dict + matching result
# ---------------------------------------------------------------------------
async def _build_line_item(
    supabase: Client,
    raw: dict,
    vendor_id: str | None,
    user: CurrentUser,
    line_idx: int,
) -> LineItem:
    desc = raw.get("description", "")
    qty = float(raw.get("quantity", 0))
    unit_price = float(raw.get("unit_price", 0))
    total_price = round(qty * unit_price, 4)

    # Run embedding + matching pipeline
    match_result = await run_matching(supabase, desc, incoming_specs=raw)

    match_status_str = match_result.get("match_status", "new_material")
    matched_id = match_result.get("matched_material_id")
    is_new = match_status_str == "new_material"
    cnmc = match_result.get("cnmc")

    # If brand-new material, generate CNMC
    quality_grade = ""
    if is_new:
        cnmc_data = await generate_cnmc(
            supabase, desc, str(raw), raw.get("quality_grade", "")
        )
        cnmc = cnmc_data.get("cnmc")
        quality_grade = cnmc_data.get("quality", "")

        # Persist the new material
        embedding = await generate_embedding(desc)
        new_mat = {
            "cnmc": cnmc,
            "category": cnmc_data.get("category", "MISC"),
            "subcategory": cnmc_data.get("subcategory", "GEN"),
            "type": cnmc_data.get("type"),
            "spec": cnmc_data.get("spec"),
            "quality": cnmc_data.get("quality"),
            "standard_description": cnmc_data.get("standard_description", desc),
            "short_description": cnmc_data.get("short_description"),
            "status": "pending",
            "embedding": embedding,
            "created_by": user.id,
        }
        mat_resp = supabase.table("materials").insert(new_mat).execute()
        if mat_resp.data:
            matched_id = mat_resp.data[0]["id"]
            log_action(supabase, user.id, user.role, "cnmc_generated",
                       "materials", matched_id, None, {"cnmc": cnmc})

    try:
        ms = MatchStatus(match_status_str)
    except ValueError:
        ms = MatchStatus.uncertain

    return LineItem(
        line_id=raw.get("line_id", f"li_{line_idx:03d}"),
        description=desc,
        quantity=qty,
        unit=raw.get("unit", "EA"),
        unit_price=unit_price,
        total_price=total_price,
        batch_number=raw.get("batch_number"),
        hsn_code=raw.get("hsn_code"),
        match_status=ms,
        matched_material_id=matched_id,
        matched_description=match_result.get("matched_description"),
        confidence=match_result.get("confidence", 0.0),
        match_reason=match_result.get("match_reason"),
        cnmc=cnmc,
        is_new_material=is_new,
        quality_grade=quality_grade or raw.get("quality_grade", ""),
        quality_notes=raw.get("quality_notes", ""),
        location_code=raw.get("location_code"),
        vendor_id=vendor_id,
        barcode=raw.get("barcode"),
        expiry_date=raw.get("expiry_date"),
    )


# ---------------------------------------------------------------------------
# POST /intake/ocr
# ---------------------------------------------------------------------------
@router.post("/ocr", response_model=OCRResponse)
async def intake_ocr(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    vendor_id: str = Form(None),
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role not in ("entry_operator", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    file_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"

    # Upload to Supabase Storage
    try:
        bill_url = await upload_bill_to_storage(supabase, file_bytes, file.filename or "bill.jpg", content_type)
    except Exception as exc:
        bill_url = None
        print(f"[intake/ocr] Storage upload failed (non-fatal): {exc}")

    # Run OCR
    raw_items = await run_ocr(file_bytes, content_type)
    if not raw_items:
        raise HTTPException(status_code=422, detail="Could not extract line items from the image")

    # Build enriched line items
    line_items = []
    for idx, raw in enumerate(raw_items):
        li = await _build_line_item(supabase, raw, vendor_id, current_user, idx + 1)
        line_items.append(li)

    draft_id = f"draft-{uuid.uuid4()}"
    return OCRResponse(receipt_id=draft_id, line_items=line_items)


# ---------------------------------------------------------------------------
# POST /intake/barcode
# ---------------------------------------------------------------------------
@router.post("/barcode", response_model=LineItem)
async def intake_barcode(
    body: BarcodeRequest,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    code = body.code.strip()

    # 1. Check material_code_mappings.legacy_code
    mapping = (
        supabase.table("material_code_mappings")
        .select("material_id")
        .eq("legacy_code", code)
        .maybe_single()
        .execute()
    )

    material = None
    if mapping.data:
        mat_resp = (
            supabase.table("materials")
            .select("*")
            .eq("id", mapping.data["material_id"])
            .single()
            .execute()
        )
        material = mat_resp.data

    # 2. If not found, check materials.cnmc directly
    if not material:
        mat_resp = (
            supabase.table("materials")
            .select("*")
            .eq("cnmc", code)
            .maybe_single()
            .execute()
        )
        material = mat_resp.data if mat_resp.data else None

    # 3. Found: return pre-filled LineItem
    if material:
        return LineItem(
            line_id=f"li_barcode_{uuid.uuid4().hex[:6]}",
            description=material.get("standard_description", ""),
            quantity=1.0,
            unit=material.get("uom", "EA"),
            unit_price=0.0,
            total_price=0.0,
            hsn_code=material.get("hsn_code"),
            match_status=MatchStatus.exact_match,
            matched_material_id=material["id"],
            matched_description=material.get("standard_description"),
            confidence=1.0,
            match_reason="Exact barcode / CNMC lookup.",
            cnmc=material.get("cnmc"),
            is_new_material=False,
            quality_grade=material.get("quality_grade", ""),
            barcode=code,
        )

    # 4. Not found: run new-material flow
    raw = {"description": code, "quantity": 1, "unit": "EA", "unit_price": 0, "barcode": code}
    li = await _build_line_item(supabase, raw, None, current_user, 1)
    li.is_new_material = True
    return li


# ---------------------------------------------------------------------------
# POST /intake/confirm
# ---------------------------------------------------------------------------
@router.post("/confirm", response_model=ConfirmResponse)
async def intake_confirm(
    body: ConfirmRequest,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role not in ("entry_operator", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    from datetime import date as dt_date
    receipt_date = body.receipt_date if isinstance(body.receipt_date, str) else body.receipt_date.isoformat()

    # Create goods_receipt
    gr_resp = supabase.table("goods_receipts").insert({
        "vendor_id": body.vendor_id,
        "receipt_date": receipt_date,
        "po_number": body.po_number,
        "bill_image_url": body.bill_image_url,
        "status": "confirmed",
        "created_by": current_user.id,
    }).execute()

    if not gr_resp.data:
        raise HTTPException(status_code=500, detail="Failed to create goods receipt")

    receipt_id = gr_resp.data[0]["id"]

    created_count = 0
    for li in body.line_items:
        expiry = li.expiry_date.isoformat() if li.expiry_date else None

        # Insert gr_line_item
        li_resp = supabase.table("gr_line_items").insert({
            "receipt_id": receipt_id,
            "material_id": li.matched_material_id,
            "line_id": li.line_id,
            "description": li.description,
            "quantity": li.quantity,
            "unit": li.unit,
            "unit_price": li.unit_price,
            "batch_number": li.batch_number,
            "hsn_code": li.hsn_code,
            "location_code": li.location_code,
            "barcode": li.barcode,
            "expiry_date": expiry,
            "quality_grade": li.quality_grade,
            "quality_notes": li.quality_notes,
        }).execute()
        created_count += 1

        material_id = li.matched_material_id
        if not material_id:
            continue

        # Update / upsert inventory
        inv = (
            supabase.table("inventory")
            .select("id, quantity_on_hand")
            .eq("material_id", material_id)
            .eq("location_code", li.location_code or "DEFAULT")
            .maybe_single()
            .execute()
        )

        if inv.data:
            old_qty = float(inv.data["quantity_on_hand"])
            new_qty = old_qty + li.quantity
            supabase.table("inventory").update({
                "quantity_on_hand": new_qty,
                "last_receipt_date": receipt_date,
            }).eq("id", inv.data["id"]).execute()
            log_action(supabase, current_user.id, current_user.role, "inventory_updated",
                       "inventory", inv.data["id"], {"quantity_on_hand": old_qty},
                       {"quantity_on_hand": new_qty})
        else:
            supabase.table("inventory").insert({
                "material_id": material_id,
                "location_code": li.location_code or "DEFAULT",
                "quantity_on_hand": li.quantity,
                "last_receipt_date": receipt_date,
            }).execute()

        # Write price_history
        supabase.table("price_history").insert({
            "material_id": material_id,
            "vendor_id": body.vendor_id,
            "purchase_date": receipt_date,
            "unit_price": li.unit_price,
            "quantity": li.quantity,
            "po_number": body.po_number,
            "receipt_id": receipt_id,
        }).execute()

    log_action(supabase, current_user.id, current_user.role, "receipt_confirmed",
               "goods_receipts", receipt_id, None,
               {"vendor_id": body.vendor_id, "po_number": body.po_number,
                "line_items_count": created_count})

    return ConfirmResponse(
        receipt_id=receipt_id,
        status="confirmed",
        line_items_created=created_count,
    )


# ---------------------------------------------------------------------------
# GET /intake/receipts
# ---------------------------------------------------------------------------
@router.get("/receipts")
async def list_receipts(
    limit: int = 20,
    offset: int = 0,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = supabase.table("goods_receipts").select("*").order("created_at", desc=True)
    if current_user.role in ("entry_operator",):
        q = q.eq("created_by", current_user.id)
    resp = q.range(offset, offset + limit - 1).execute()
    return resp.data or []


# ---------------------------------------------------------------------------
# GET /intake/receipts/{id}
# ---------------------------------------------------------------------------
@router.get("/receipts/{receipt_id}")
async def get_receipt(
    receipt_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: CurrentUser = Depends(get_current_user),
):
    gr = supabase.table("goods_receipts").select("*").eq("id", receipt_id).single().execute()
    if not gr.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    items = (
        supabase.table("gr_line_items")
        .select("*")
        .eq("receipt_id", receipt_id)
        .execute()
    )
    return {**gr.data, "line_items": items.data or []}
