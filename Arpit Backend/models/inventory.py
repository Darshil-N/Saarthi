from __future__ import annotations
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class InventoryItem(BaseModel):
    id: str
    material_id: str
    location_code: str
    quantity_on_hand: float
    quantity_reserved: float
    last_receipt_date: Optional[date] = None
    updated_at: datetime


class InventoryAdjustRequest(BaseModel):
    quantity_delta: float
    reason: Optional[str] = None
