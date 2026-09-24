from __future__ import annotations
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class MaterialStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    deprecated = "deprecated"


class MaterialOut(BaseModel):
    id: str
    cnmc: Optional[str] = None
    category: str
    subcategory: str
    type: Optional[str] = None
    spec: Optional[str] = None
    quality: Optional[str] = None
    standard_description: str
    short_description: Optional[str] = None
    uom: str
    hsn_code: Optional[str] = None
    quality_grade: Optional[str] = None
    status: MaterialStatus
    created_at: datetime
    updated_at: datetime


class MaterialApproveRequest(BaseModel):
    approved: bool = True
