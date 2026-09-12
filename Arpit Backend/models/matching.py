from __future__ import annotations
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class MatchStatusEnum(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class MatchingQueueItem(BaseModel):
    id: str
    incoming_description: str
    incoming_specs: Optional[dict] = None
    candidate_material_id: Optional[str] = None
    match_type: Optional[str] = None
    match_status: MatchStatusEnum
    confidence_score: Optional[float] = None
    similarity_score: Optional[float] = None
    match_reason: Optional[str] = None
    created_at: datetime


class MatchDecisionRequest(BaseModel):
    notes: Optional[str] = None
