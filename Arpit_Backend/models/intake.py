from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from enum import Enum


class MatchStatus(str, Enum):
    exact_match = "exact_match"
    near_duplicate = "near_duplicate"
    new_material = "new_material"
    uncertain = "uncertain"


class LineItem(BaseModel):
    """Exact contract shape used by both OCR response and confirm request."""
    line_id: str
    description: str
    quantity: float
    unit: str
    unit_price: float
    total_price: float
    batch_number: Optional[str] = None
    hsn_code: Optional[str] = None
    match_status: MatchStatus = MatchStatus.new_material
    matched_material_id: Optional[str] = None
    matched_description: Optional[str] = None
    confidence: float = 0.0
    match_reason: Optional[str] = None
    cnmc: Optional[str] = None
    is_new_material: bool = True
    quality_grade: Optional[str] = ""
    quality_notes: Optional[str] = ""
    location_code: Optional[str] = None
    vendor_id: Optional[str] = None
    barcode: Optional[str] = None
    expiry_date: Optional[date] = None


class OCRResponse(BaseModel):
    receipt_id: str
    line_items: List[LineItem]
    bill_image_url: Optional[str] = None


class BarcodeRequest(BaseModel):
    code: str


class ConfirmRequest(BaseModel):
    vendor_id: str
    receipt_date: date
    po_number: Optional[str] = None
    bill_image_url: Optional[str] = None
    line_items: List[LineItem]


class ConfirmResponse(BaseModel):
    receipt_id: str
    status: str
    line_items_created: int
