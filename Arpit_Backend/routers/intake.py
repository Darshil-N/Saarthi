import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from supabase import Client

from dependencies import get_supabase, get_current_user, CurrentUser
from models.intake import OCRResponse, LineItem, MatchStatus, ConfirmRequest, ConfirmResponse, BarcodeRequest
from services.ocr_service import upload_bill_to_storage, run_ocr
from services.matching_service import run_matching
from services.cnmc_service import generate_cnmc
from services.audit_service import log_action

router = APIRouter()

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

    match_result = await run_matching(supabase, desc, incoming_specs=raw)

    match_status_str = match_result.get("match_status", "new_material")
    matched_id = match_result.get("matched_material_id")
    is_new = match_status_str == "new_material"
    cnmc = match_result.get("cnmc")
    
    # 1. Generate CNMC classification for the incoming material
    if is_new:
        cnmc_data = await generate_cnmc(supabase, desc, str(raw), raw.get("quality_grade", ""))
    else:
        mc = match_result.get("master_candidate", {})
        cnmc_data = {
            "cnmc": mc.get("cnmc"),
            "category": mc.get("category", "MISC"),
            "subcategory": mc.get("subcategory", "GEN"),
            "type": mc.get("material_type"),
            "spec": mc.get("spec"),
            "quality": mc.get("quality_grade"),
            "standard_description": mc.get("standard_description", desc),
            "short_description": mc.get("short_description")
        }

    cnmc = cnmc_data.get("cnmc")
    quality_grade = cnmc_data.get("quality", "")
    if quality_grade not in ("A", "B", "C"):
        quality_grade = "A"

    # 2. Always create a pending material for the incoming item
    new_mat = {
        "cnmc": cnmc,
        "category": cnmc_data.get("category", "MISC"),
        "subcategory": cnmc_data.get("subcategory", "GEN"),
        "material_type": cnmc_data.get("type"),
        "spec": cnmc_data.get("spec"),
        "quality_grade": quality_grade,
        "standard_description": cnmc_data.get("standard_description", desc),
        "short_description": cnmc_data.get("short_description"),
        "status": "pending",
        "embedding": match_result.get("embedding"),
        "created_by": user.id,
        "unit_of_measure": raw.get("unit", "EA"),
    }
    
    new_material_id = None
    for attempt in range(5):
        try:
            mat_resp = supabase.table("materials").insert(new_mat).execute()
            if mat_resp.data:
                new_material_id = mat_resp.data[0]["id"]
                if is_new:
                    log_action(supabase, user.id, user.role, "cnmc_generated", "materials", new_material_id, None, {"cnmc": new_mat["cnmc"]})
            break
        except Exception as e:
            is_cnmc_conflict = new_mat.get("cnmc") and "materials_cnmc_key" in str(e)
            if is_cnmc_conflict and attempt < 4:
                new_mat["cnmc"] = f"{cnmc}-{attempt + 2}"
                continue
            print(f"Failed to insert pending material: {e}")
            break

    # 3. Insert into matching_queue
    if new_material_id:
        queue_row = {
            "new_material_id": new_material_id,
            "matched_material_id": matched_id,
            "match_type": match_result.get("match_type", "different"),
            "confidence_score": match_result.get("confidence", 0.0),
            "vector_similarity": match_result.get("vector_similarity", 0.0),
            "match_reason": match_result.get("match_reason", ""),
            "status": "pending"
        }
        try:
            supabase.table("matching_queue").insert(queue_row).execute()
        except Exception as e:
            print(f"Failed to insert matching_queue: {e}")

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
        cnmc=new_mat.get("cnmc") or cnmc,
        is_new_material=is_new,
        quality_grade=quality_grade or raw.get("quality_grade", ""),
        quality_notes=raw.get("quality_notes", ""),
        location_code=raw.get("location_code"),
        vendor_id=vendor_id,
        barcode=raw.get("barcode"),
        expiry_date=raw.get("expiry_date"),
    )

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

    try:
        bill_url = await upload_bill_to_storage(supabase, file_bytes, content_type)
    except Exception as exc:
        bill_url = None
        print(f"[intake/ocr] Storage upload failed: {exc}")

    raw_items = await run_ocr(file_bytes, content_type)
    if not raw_items:
        raise HTTPException(status_code=422, detail="Could not extract line items")

    line_items = []
    for idx, raw in enumerate(raw_items):
        li = await _build_line_item(supabase, raw, vendor_id, current_user, idx + 1)
        line_items.append(li)

    draft_id = f"draft-{uuid.uuid4()}"
    return OCRResponse(receipt_id=draft_id, line_items=line_items, bill_image_url=bill_url or None)

@router.post("/barcode")
async def intake_barcode(body: BarcodeRequest, supabase: Client = Depends(get_supabase), current_user: CurrentUser = Depends(get_current_user)):
    code = body.code.strip()

    material_id = None
    # 1. Check legacy code mappings first (CNMC + legacy code lookup)
    mapping_resp = (
        supabase.table("material_code_mappings")
        .select("material_id")
        .eq("legacy_code", code)
        .limit(1)
        .execute()
    )
    if mapping_resp.data:
        material_id = mapping_resp.data[0]["material_id"]

    # 2. Fall back to direct CNMC match
    if not material_id:
        cnmc_resp = (
            supabase.table("materials")
            .select("id")
            .eq("cnmc", code)
            .limit(1)
            .execute()
        )
        if cnmc_resp.data:
            material_id = cnmc_resp.data[0]["id"]

    if not material_id:
        return {"found": False, "barcode": code}

    mat_resp = (
        supabase.table("materials")
        .select("id, cnmc, standard_description, unit_of_measure, quality_grade")
        .eq("id", material_id)
        .single()
        .execute()
    )
    if not mat_resp.data:
        return {"found": False, "barcode": code}

    material = mat_resp.data

    # Last known price from price_history
    price_resp = (
        supabase.table("price_history")
        .select("unit_price")
        .eq("material_id", material_id)
        .order("purchase_date", desc=True)
        .limit(1)
        .execute()
    )
    last_price = price_resp.data[0]["unit_price"] if price_resp.data else 0.0

    return {
        "found": True,
        "barcode": code,
        "matched_material_id": material["id"],
        "cnmc": material["cnmc"],
        "description": material["standard_description"],
        "unit": material.get("unit_of_measure", "EA"),
        "unit_price": last_price,
        "quality_grade": material.get("quality_grade", ""),
        "match_status": "exact_match",
        "is_new_material": False,
        "confidence": 1.0,
    }

@router.get("/receipts")
async def get_receipts(limit: int = 10, supabase: Client = Depends(get_supabase), current_user: CurrentUser = Depends(get_current_user)):
    resp = supabase.table("goods_receipts").select("*, vendors(name), gr_line_items(id)").order("created_at", desc=True).limit(limit).execute()
    receipts = []
    for row in (resp.data or []):
        vendor = row.get("vendors") or {}
        receipts.append({
            "id": row["id"],
            "vendor_id": row["vendor_id"],
            "vendor_name": vendor.get("name") or "Unknown Vendor",
            "receipt_date": row["receipt_date"],
            "status": row["status"],
            "items_count": len(row.get("gr_line_items", [])),
        })
    return receipts



@router.post("/confirm", response_model=ConfirmResponse)
async def confirm_receipt(body: ConfirmRequest, supabase: Client = Depends(get_supabase), current_user: CurrentUser = Depends(get_current_user)):
    # 1. Create Goods Receipt
    gr_payload = {
        "vendor_id": body.vendor_id,
        "receipt_date": body.receipt_date.isoformat(),
        "po_number": body.po_number,
        "bill_image_url": body.bill_image_url,
        "received_by": current_user.id,
        "status": "completed"
    }
    gr_resp = supabase.table("goods_receipts").insert(gr_payload).execute()
    if not gr_resp.data:
        raise HTTPException(status_code=500, detail="Failed to create goods receipt")
    
    gr_id = gr_resp.data[0]["id"]
    
    # 2. Insert Line Items
    items_to_insert = []
    for item in body.line_items:
        items_to_insert.append({
            "gr_id": gr_id,
            "material_id": item.matched_material_id,
            "quantity_received": item.quantity,
            "unit_of_measure": item.unit,
            "unit_price": item.unit_price,
            "quality_grade": item.quality_grade,
            "quality_notes": item.quality_notes,
            "location_code": item.location_code,
            "barcode": item.barcode,
            "batch_number": item.batch_number,
            "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
            "raw_description": item.description,
            "match_status": item.match_status.value
        })
    
    if items_to_insert:
        li_resp = supabase.table("gr_line_items").insert(items_to_insert).execute()
        if not li_resp.data:
            print("Warning: failed to insert gr_line_items")
            
    # Also log the action
    log_action(supabase, current_user.id, current_user.role, "receipt_confirmed", "goods_receipts", gr_id, None, None)

    return ConfirmResponse(
        receipt_id=gr_id,
        status="success",
        line_items_created=len(items_to_insert)
    )
