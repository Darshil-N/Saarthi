import asyncio
import logging
import re
import uuid
from typing import Any

from supabase import Client

from config import settings
from services.ai_common import generate_text
from services.json_utils import extract_json

logger = logging.getLogger(__name__)

BILL_BUCKET = "bill-images"

# Content types accepted for uploaded bills, with the file extension used in storage.
ALLOWED_BILL_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}

OCR_PROMPT = """
You are an expert OCR AI specialized in processing industrial goods receipts, invoices, and material inwards documents.
Your goal is to extract LINE ITEMS from the provided image and output them in a structured JSON array.

Analyze the image and return a JSON array containing one object for each line item found.
Do NOT wrap the output in markdown code blocks, just raw JSON.

Each object MUST have the following keys:
- line_id: String. A sequential ID or the line number from the receipt (e.g. "1").
- description: String. The full text description of the material.
- quantity: Number. The quantity received.
- unit: String. The unit of measure (e.g. "EA", "KG", "LTR", "MTR"). Default to "EA" if missing.
- unit_price: Number. The price per unit.
- total_price: Number. The total price for this line item.
- batch_number: String or null.
- hsn_code: String or null.
- quality_grade: String or null. Look for indications like "Grade A", "Standard", "Acceptable".
"""


class OCRUnreadableError(Exception):
    """The bill was processed but no line items could be found in it."""


_NUMBER = re.compile(r"-?\d+(?:\.\d+)?")


def to_number(value: Any) -> float | None:
    """Best-effort numeric value from OCR output: 5, "5", "1,200.50", "₹ 120", "5 nos" -> float."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    match = _NUMBER.search(str(value).replace(",", ""))
    return float(match.group()) if match else None


def _clean_text(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def parse_ocr_items(data: Any) -> list[dict]:
    """Normalise whatever the model returned into clean line-item dicts.

    Items without a description are dropped. Line ids are assigned here (the model's own ids can
    repeat, and the UI keys rows by id). Missing or unparsable numbers become 0 so the operator
    is prompted to fill them in rather than the request failing.
    """
    if isinstance(data, dict):
        data = data.get("line_items") or data.get("items") or ([data] if data.get("description") else [])
    if not isinstance(data, list):
        return []

    items: list[dict] = []
    for raw in data:
        if not isinstance(raw, dict):
            continue
        description = _clean_text(raw.get("description"))
        if not description:
            continue

        quantity = to_number(raw.get("quantity"))
        quantity = quantity if quantity is not None and quantity > 0 else 0.0
        unit_price = to_number(raw.get("unit_price"))
        if unit_price is None or unit_price < 0:
            total = to_number(raw.get("total_price"))
            unit_price = round(total / quantity, 4) if total and quantity else 0.0

        grade = (_clean_text(raw.get("quality_grade")) or "").upper()
        items.append({
            "line_id": f"li_{len(items) + 1:03d}",
            "description": description,
            "quantity": quantity,
            "unit": (_clean_text(raw.get("unit")) or "EA").upper(),
            "unit_price": unit_price,
            "batch_number": _clean_text(raw.get("batch_number")),
            "hsn_code": _clean_text(raw.get("hsn_code")),
            "quality_grade": grade if grade in ("A", "B", "C") else None,
        })
    return items


async def run_ocr(file_bytes: bytes, mime_type: str = "image/jpeg") -> list[dict]:
    """Extract line items from a bill.

    Raises OCRUnreadableError when the reply contains no usable items, and AIServiceError
    (AIQuotaError for rate limits) when the AI service itself failed, so callers can tell
    the operator which of the two happened.
    """
    reply = await generate_text(
        settings.GEMINI_MODEL_OCR,
        [OCR_PROMPT, {"mime_type": mime_type, "data": file_bytes}],
    )
    try:
        items = parse_ocr_items(extract_json(reply))
    except ValueError as exc:
        logger.warning("OCR reply was not valid JSON: %s | reply starts: %r", exc, reply[:200])
        raise OCRUnreadableError("The AI reply could not be understood") from exc
    if not items:
        raise OCRUnreadableError("No line items found")
    return items


async def upload_bill_to_storage(supabase: Client, file_bytes: bytes, content_type: str) -> str | None:
    """Store the bill in the private bucket. Returns the object path, or None if storage failed.

    A failed upload must not block intake (the OCR result is still useful), so it is logged
    and reported as None; the receipt is then saved without a bill image.
    """
    path = f"{uuid.uuid4()}.{ALLOWED_BILL_TYPES.get(content_type, 'bin')}"

    def _upload() -> None:
        supabase.storage.from_(BILL_BUCKET).upload(
            path=path, file=file_bytes, file_options={"content-type": content_type}
        )

    try:
        await asyncio.to_thread(_upload)
    except Exception:
        logger.warning("Bill upload to storage failed", exc_info=True)
        return None
    return path


def signed_bill_url(supabase: Client, stored: str | None) -> str | None:
    """Turn a stored bill reference into a URL the browser can open.

    The bucket is private, so object paths need a time-limited signed URL. Older rows may hold a
    full URL (which no longer works for a private bucket) and are returned unchanged.
    """
    if not stored:
        return None
    if stored.startswith("http"):
        return stored
    try:
        result = supabase.storage.from_(BILL_BUCKET).create_signed_url(stored, settings.SIGNED_URL_TTL_SECONDS)
        return result.get("signedURL") or result.get("signedUrl")
    except Exception:
        logger.warning("Could not sign URL for %s", stored, exc_info=True)
        return None
