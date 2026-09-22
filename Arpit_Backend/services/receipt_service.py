"""Goods-receipt business logic: confirming a receipt, and reading receipts back.

Confirming a receipt writes to several tables (goods_receipts, gr_line_items, materials,
matching_queue, inventory, price_history, audit_log). Plan step 1.2.2 / decision D-6 (decided
2026-09-22): this now happens inside the confirm_receipt database function
(migrations/002_confirm_and_approve_rpcs.sql), which Postgres always runs as one transaction — if
anything fails, everything it already wrote is rolled back automatically. This module's job is to
validate the request with readable error messages (so a bad line is reported before anything is
sent to the database), assemble the RPC payload, compute a fresh embedding for any brand-new
material (so the stored vector matches the final, possibly-edited description - finding A5), and
translate the RPC's result or error into an HTTP response.
"""
import asyncio
import logging
import uuid
from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from supabase import Client

from dependencies import CurrentUser
from models.intake import ConfirmRequest
from services.embedding_service import generate_embedding
from services.ocr_service import signed_bill_url

logger = logging.getLogger(__name__)

_QTY_STEP = Decimal("0.001")
_VALID_STATUSES = ("draft", "processing", "completed", "rejected")


# ----------------------------------------------------------------------- validation

def _validate_request(supabase: Client, body: ConfirmRequest) -> None:
    """Check everything the database would otherwise reject with a much less readable error."""
    problems: list[str] = []

    try:
        vendor_id = str(uuid.UUID(body.vendor_id))
        vendor = supabase.table("vendors").select("id").eq("id", vendor_id).eq("is_active", True).maybe_single().execute()
        if not vendor or not vendor.data:
            problems.append("The selected vendor does not exist or is inactive")
    except ValueError:
        problems.append("The selected vendor is not valid")

    codes = sorted({i.location_code for i in body.line_items})
    found = supabase.table("locations").select("code").in_("code", codes).eq("is_active", True).execute().data or []
    unknown = set(codes) - {r["code"] for r in found}
    if unknown:
        problems.append(f"Unknown storage location(s): {', '.join(sorted(unknown))}")

    existing_ids: list[str] = []
    id_by_idx: dict[int, str] = {}
    for idx, item in enumerate(body.line_items):
        if item.material_id:
            try:
                material_id = str(uuid.UUID(item.material_id))
            except ValueError:
                problems.append(f"Line {idx + 1} refers to an invalid material")
                continue
            id_by_idx[idx] = material_id
            existing_ids.append(material_id)
        elif not (item.category and item.subcategory and item.material_type and item.standard_description):
            problems.append(
                f"Line {idx + 1} ('{item.description[:40]}') is not linked to a material and is "
                "missing the classification needed to create one, so stock cannot be recorded for it"
            )

    if existing_ids:
        rows = supabase.table("materials").select("id, status").in_("id", sorted(set(existing_ids))).execute().data or []
        by_id = {r["id"]: r["status"] for r in rows}
        for idx, material_id in id_by_idx.items():
            if material_id not in by_id:
                problems.append(f"Line {idx + 1}: the linked material no longer exists")
            elif by_id[material_id] == "deprecated":
                problems.append(f"Line {idx + 1}: the linked material has been deprecated")

    if problems:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="; ".join(problems))


def _existing_receipt(supabase: Client, draft_id: str, user_id: str) -> dict | None:
    """Cheap pre-check so a retried request skips embedding generation; the RPC's own unique
    index on (received_by, client_draft_id) is what actually closes the race if two requests
    land at once (finding E3)."""
    resp = (
        supabase.table("goods_receipts")
        .select("id, gr_number, total_value, gr_line_items(id)")
        .eq("received_by", user_id)
        .eq("client_draft_id", draft_id)
        .limit(1)
        .execute()
    )
    return (resp.data or [None])[0]


# ------------------------------------------------------------------------ confirm

async def _line_payload(item, description: str) -> dict:
    """Build one line of the RPC payload, embedding a brand-new material's final description."""
    payload = {
        "quantity": item.quantity,
        "unit": item.unit,
        "unit_price": item.unit_price,
        "quality_grade": item.quality_grade,
        "quality_notes": item.quality_notes,
        "location_code": item.location_code,
        "barcode": item.barcode,
        "batch_number": item.batch_number,
        "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
        "raw_description": description,
        "match_status": item.match_status.value,
        "material_id": item.material_id,
        "new_material": None,
        "candidate_match": None,
    }
    if not item.material_id:
        embedding = await generate_embedding(item.standard_description or description)
        payload["new_material"] = {
            "cnmc": item.cnmc,
            "category": item.category,
            "subcategory": item.subcategory,
            "material_type": item.material_type,
            "spec": item.spec,
            "quality_grade": item.quality_grade,
            "standard_description": item.standard_description or description,
            "short_description": item.short_description,
            "technical_specs": item.technical_specs,
            "unit_of_measure": item.unit,
            "embedding": embedding,
        }
        if item.candidate_material_id:
            payload["candidate_match"] = {
                "matched_material_id": item.candidate_material_id,
                "match_type": item.match_type,
                "confidence_score": item.confidence,
                "vector_similarity": item.vector_similarity,
                "match_reason": item.match_reason,
            }
    return payload


def _rpc_error_detail(exc: APIError) -> tuple[int, str]:
    """Map the confirm_receipt RPC's RAISE EXCEPTION prefixes to an HTTP status and message."""
    msg = str(exc)
    if "VALIDATION:" in msg:
        return status.HTTP_422_UNPROCESSABLE_ENTITY, msg.split("VALIDATION:", 1)[1].strip()
    return status.HTTP_500_INTERNAL_SERVER_ERROR, "The receipt could not be saved. Please try again."


async def confirm_receipt(supabase: Client, user: CurrentUser, body: ConfirmRequest) -> dict:
    """Validate a receipt, then confirm it in one transaction via the confirm_receipt RPC."""
    if body.client_draft_id:
        existing = await asyncio.to_thread(_existing_receipt, supabase, body.client_draft_id, user.id)
        if existing:
            return {
                "receipt_id": existing["id"],
                "gr_number": existing["gr_number"],
                "line_items_created": len(existing.get("gr_line_items") or []),
                "total_value": float(existing.get("total_value") or 0),
                "already_confirmed": True,
            }

    await asyncio.to_thread(_validate_request, supabase, body)

    line_items = [await _line_payload(item, item.description) for item in body.line_items]
    payload = {
        "vendor_id": body.vendor_id,
        "receipt_date": body.receipt_date.isoformat(),
        "po_number": body.po_number or None,
        "bill_image_path": body.bill_image_path,
        "client_draft_id": body.client_draft_id,
        "received_by": user.id,
        "received_by_role": user.role,
        "line_items": line_items,
    }

    try:
        resp = await asyncio.to_thread(
            lambda: supabase.rpc("confirm_receipt", {"p_payload": payload}).execute()
        )
    except APIError as exc:
        code, detail = _rpc_error_detail(exc)
        if code != status.HTTP_422_UNPROCESSABLE_ENTITY:
            logger.exception("confirm_receipt RPC failed (draft %s)", body.client_draft_id)
        raise HTTPException(code, detail=detail)

    result = resp.data or {}
    return {
        "receipt_id": result["receipt_id"],
        "gr_number": result["gr_number"],
        "line_items_created": result["line_items_created"],
        "total_value": float(result["total_value"] or 0),
        "already_confirmed": bool(result["already_confirmed"]),
    }


# -------------------------------------------------------------------------- reads

def _receipt_total(row: dict) -> float:
    if row.get("total_value") is not None:
        return float(row["total_value"])
    lines = row.get("gr_line_items") or []
    return round(sum(float(l.get("quantity_received") or 0) * float(l.get("unit_price") or 0) for l in lines), 2)


def list_receipts(
    supabase: Client,
    *,
    vendor_id: str | None,
    receipt_status: str | None,
    from_date: date | None,
    to_date: date | None,
    limit: int,
    offset: int,
) -> list[dict]:
    if receipt_status and receipt_status not in _VALID_STATUSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown status '{receipt_status}'")

    q = supabase.table("goods_receipts").select(
        "id, gr_number, vendor_id, po_number, receipt_date, status, total_value, created_at, "
        "vendors(name), gr_line_items(quantity_received, unit_price)"
    )
    if vendor_id:
        q = q.eq("vendor_id", vendor_id)
    if receipt_status:
        q = q.eq("status", receipt_status)
    if from_date:
        q = q.gte("receipt_date", from_date.isoformat())
    if to_date:
        q = q.lte("receipt_date", to_date.isoformat())

    rows = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute().data or []
    return [
        {
            "id": r["id"],
            "gr_number": r["gr_number"],
            "vendor_id": r["vendor_id"],
            "vendor_name": (r.get("vendors") or {}).get("name") or "Unknown Vendor",
            "po_number": r.get("po_number"),
            "receipt_date": r["receipt_date"],
            "status": r["status"],
            "items_count": len(r.get("gr_line_items") or []),
            "total_value": _receipt_total(r),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


def get_receipt_detail(supabase: Client, receipt_id: str) -> dict | None:
    resp = (
        supabase.table("goods_receipts")
        .select(
            "*, vendors(id, name, code), "
            "gr_line_items(*, materials(id, cnmc, standard_description, status))"
        )
        .eq("id", receipt_id)
        .maybe_single()
        .execute()
    )
    row = resp.data if resp else None
    if not row:
        return None

    vendor = row.get("vendors") or {}
    lines = sorted(row.get("gr_line_items") or [], key=lambda l: (l.get("created_at") or "", l["id"]))

    def _line_description(l: dict) -> str:
        return l.get("raw_description") or (l.get("materials") or {}).get("standard_description") or ""

    def _matched_description(l: dict) -> str | None:
        standard = (l.get("materials") or {}).get("standard_description")
        return standard if standard and standard != _line_description(l) else None

    return {
        "id": row["id"],
        "gr_number": row["gr_number"],
        "status": row["status"],
        "receipt_date": row["receipt_date"],
        "po_number": row.get("po_number"),
        "notes": row.get("notes"),
        "created_at": row["created_at"],
        "vendor_id": row.get("vendor_id"),
        "vendor_name": vendor.get("name") or "Unknown Vendor",
        "vendor_code": vendor.get("code"),
        "bill_image_url": signed_bill_url(supabase, row.get("bill_image_url")),
        "total_value": _receipt_total(row),
        "line_items": [
            {
                "line_id": l["id"],
                "material_id": l.get("material_id"),
                "description": _line_description(l),
                "matched_description": _matched_description(l),
                "cnmc": (l.get("materials") or {}).get("cnmc"),
                "material_status": (l.get("materials") or {}).get("status"),
                "quantity": float(l["quantity_received"]),
                "unit": l["unit_of_measure"],
                "unit_price": float(l["unit_price"]),
                "total_price": float(l.get("total_price") or 0),
                "quality_grade": l.get("quality_grade"),
                "quality_notes": l.get("quality_notes"),
                "location_code": l.get("location_code"),
                "barcode": l.get("barcode"),
                "batch_number": l.get("batch_number"),
                "match_status": l.get("match_status") or "new_material",
                "is_new_material": (l.get("match_status") or "new_material") == "new_material",
                "confidence": 0.0,
            }
            for l in lines
        ],
    }
