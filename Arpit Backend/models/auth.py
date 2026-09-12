from __future__ import annotations
from pydantic import BaseModel, EmailStr
from typing import Optional


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    email: str


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    plant_code: Optional[str] = None
