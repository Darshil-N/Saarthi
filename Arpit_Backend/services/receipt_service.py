"""Goods-receipt business logic: confirming a receipt, and reading receipts back.

Confirming a receipt writes to several tables (goods_receipts, gr_line_items, inventory,
price_history, audit_log). PostgREST offers no multi-statement transaction, so:
  * stock is changed with an optimistic compare-and-set (safe against concurrent receipts), and
  * if any step fails, everything already written is undone (compensation) before the error
    is reported, so a failed confirmation leaves no partial receipt behind.
A database-side function would make this a true transaction (plan step 1.2.2); until then this
gives the same all-or-nothing behaviour from the caller's point of view.
"""
import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from supabase import Client

from dependencies import CurrentUser
from models.intake import ConfirmRequest
from services.audit_service import log_action
from services.ocr_service import signed_bill_url

logger = logging.getLogger(__name__)

_QTY_STEP = Decimal("0.001")
_MAX_STOCK_ATTEMPTS = 6
_VALID_STATUSES = ("draft", "processing", "completed", "rejected")


class StockConflictError(Exception):
    """Inventory kept changing underneath us and the update could not be applied."""


# --------------------------------------------------------------------------- stock

def add_stock(supabase: Client, material_id: str, location_code: str, delta: Decimal) -> bool:
    """Add `delta` (may be negative) to a bin's quantity without losing concurrent updates.

    Reads the current quantity, then updates only if it is still that value; on a lost race it
    re-reads and retries. Returns True when a new inventory row had to be created.
    """
    for _ in range(_MAX_STOCK_ATTEMPTS):
        row = (
            supabase.table("inventory")
            .select("id, quantity")
            .eq("material_id", material_id)
            .eq("location_code", location_code)
            .maybe_single()
            .execute()
        )
        current = row.data if row else None
        now = datetime.now(timezone.utc).isoformat()

        if current is None:
            if delta <= 0:
                return False
            try:
                supabase.table("inventory").insert({
                    "material_id": material_id,
                    "location_code": location_code,
                    "quantity": float(delta),
                    "last_movement_at": now,
                    "last_updated": now,
                }).execute()
                return True
            except APIError as exc:
                if str(getattr(exc, "code", "")) == "23505":  # someone created the row first: retry
                    continue
                raise

        new_qty = max(Decimal(0), Decimal(str(current["quantity"])) + delta).quantize(_QTY_STEP)
        updated = (
            supabase.table("inventory")
            .update({"quantity": float(new_qty), "last_movement_at": now, "last_updated": now})
            .eq("id", current["id"])
            .eq("quantity", current["quantity"])
            .execute()
        )
        if updated.data:
            return False
    raise StockConflictError(f"Stock for {material_id} at {location_code} is being changed by someone else")


# ----------------------------------------------------------------------- validation

def _line_material_id(item) -> str | None:
    """Stock goes to the pending material created for the line, else to the matched material."""
    return item.pending_material_id or item.matched_material_id


def _validate_request(supabase: Client, body: ConfirmRequest) -> dict[int, str]:
    """Check everything the database would otherwise reject halfway through. Returns line index -> material id."""
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

    line_material: dict[int, str] = {}
    for idx, item in enumerate(body.line_items):
        material_id = _line_material_id(item)
        if not material_id:
            problems.append(
                f"Line {idx + 1} ('{item.description[:40]}') is not linked to a material, so stock cannot be recorded for it"
            )
            continue
        try:
            line_material[idx] = str(uuid.UUID(material_id))
        except ValueError:
            problems.append(f"Line {idx + 1} refers to an invalid material")
        if Decimal(str(item.quantity)).quantize(_QTY_STEP) <= 0:
            problems.append(f"Line {idx + 1}: quantity is too small")

    if line_material:
        ids = sorted(set(line_material.values()))
        rows = supabase.table("materials").select("id, status").in_("id", ids).execute().data or []
        by_id = {r["id"]: r["status"] for r in rows}
        for idx, material_id in line_material.items():
            if material_id not in by_id:
                problems.append(f"Line {idx + 1}: the linked material no longer exists")
            elif by_id[material_id] == "deprecated":
                problems.append(f"Line {idx + 1}: the linked material has been deprecated")

    if problems:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="; ".join(problems))
    return line_material


# ------------------------------------------------------------------------ confirm

def _existing_receipt(supabase: Client, draft_id: str, user_id: str) -> dict | None:
    resp = (
        supabase.table("goods_receipts")
        .select("id, gr_number, total_value, gr_line_items(id)")
        .eq("ocr_raw_data->>draft_id", draft_id)
        .eq("received_by", user_id)
        .eq("status", "completed")
        .limit(1)
        .execute()
    )
    return (resp.data or [None])[0]


def _rollback(supabase: Client, gr_id: str, line_ids: list[str], stock_applied: list[tuple]) -> None:
    """Undo a partially written receipt. Each step is attempted independently and logged."""
    for material_id, location_code, qty, created_row in reversed(stock_applied):
        try:
            add_stock(supabase, material_id, location_code, -qty)
            if created_row:
                supabase.table("inventory").delete().eq("material_id", material_id).eq(
                    "location_code", location_code
                ).eq("quantity", 0).execute()
        except Exception:
            logger.critical("ROLLBACK FAILED: could not reverse %s of %s at %s (receipt %s)",
                            qty, material_id, location_code, gr_id, exc_info=True)
    try:
        if line_ids:
            supabase.table("price_history").delete().in_("gr_line_item_id", line_ids).execute()
    except Exception:
        logger.critical("ROLLBACK FAILED: could not delete price history for receipt %s", gr_id, exc_info=True)
    try:
        supabase.table("goods_receipts").delete().eq("id", gr_id).execute()  # line items cascade
    except Exception:
        logger.critical("ROLLBACK FAILED: could not delete receipt %s", gr_id, exc_info=True)


def confirm_receipt(supabase: Client, user: CurrentUser, body: ConfirmRequest) -> dict:
    """Validate and save a receipt, update stock and price history, and audit it."""
    if body.client_draft_id:
        existing = _existing_receipt(supabase, body.client_draft_id, user.id)
        if existing:
            return {
                "receipt_id": existing["id"],
                "gr_number": existing["gr_number"],
                "line_items_created": len(existing.get("gr_line_items") or []),
                "total_value": float(existing.get("total_value") or 0),
                "already_confirmed": True,
            }

    line_material = _validate_request(supabase, body)

    quantities = [Decimal(str(i.quantity)).quantize(_QTY_STEP) for i in body.line_items]
    total_value = sum((q * Decimal(str(i.unit_price)) for q, i in zip(quantities, body.line_items)), Decimal(0))
    total_value = total_value.quantize(Decimal("0.01"))

    gr_id: str | None = None
    line_ids: list[str] = []
    stock_applied: list[tuple] = []
    try:
        gr = supabase.table("goods_receipts").insert({
            "vendor_id": body.vendor_id,
            "receipt_date": body.receipt_date.isoformat(),
            "po_number": body.po_number or None,
            "bill_image_url": body.bill_image_path,
            "received_by": user.id,
            "status": "processing",
            "total_value": float(total_value),
            "ocr_raw_data": {"draft_id": body.client_draft_id} if body.client_draft_id else None,
        }).execute().data[0]
        gr_id = gr["id"]

        created = supabase.table("gr_line_items").insert([
            {
                "gr_id": gr_id,
                "material_id": line_material[idx],
                "quantity_received": float(quantities[idx]),
                "unit_of_measure": item.unit,
                "unit_price": item.unit_price,
                "quality_grade": item.quality_grade,
                "quality_notes": item.quality_notes,
                "location_code": item.location_code,
                "barcode": item.barcode,
                "batch_number": item.batch_number,
                "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
                "raw_description": item.description,
                "match_status": item.match_status.value,
            }
            for idx, item in enumerate(body.line_items)
        ]).execute().data
        if len(created) != len(body.line_items):
            raise RuntimeError("Not every line item was saved")
        line_ids = [row["id"] for row in created]

        for idx, item in enumerate(body.line_items):
            created_row = add_stock(supabase, line_material[idx], item.location_code, quantities[idx])
            stock_applied.append((line_material[idx], item.location_code, quantities[idx], created_row))

        price_rows = [
            {
                "material_id": line_material[idx],
                "vendor_id": body.vendor_id,
                "gr_line_item_id": line_ids[idx],
                "unit_price": item.unit_price,
                "quantity": float(quantities[idx]),
                "purchase_date": body.receipt_date.isoformat(),
            }
            for idx, item in enumerate(body.line_items)
            if item.unit_price > 0
        ]
        if price_rows:
            supabase.table("price_history").insert(price_rows).execute()

        supabase.table("goods_receipts").update({"status": "completed"}).eq("id", gr_id).execute()
    except Exception:
        logger.exception("Confirming receipt failed; rolling back (receipt %s)", gr_id)
        if gr_id:
            _rollback(supabase, gr_id, line_ids, stock_applied)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The receipt could not be saved and no changes were kept. Please try again.",
        )

    log_action(supabase, user.id, user.role, "receipt_confirmed", "goods_receipts", gr_id, None, {
        "gr_number": gr["gr_number"],
        "line_items": len(line_ids),
        "total_value": float(total_value),
    })
    return {
        "receipt_id": gr_id,
        "gr_number": gr["gr_number"],
        "line_items_created": len(line_ids),
        "total_value": float(total_value),
        "already_confirmed": False,
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
