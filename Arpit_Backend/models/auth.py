from __future__ import annotations
from pydantic import BaseModel
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
    full_name: Optional[str] = None
    role: str
    department: Optional[str] = None
    employee_id: Optional[str] = None
    is_active: bool = True
    email: Optional[str] = None  # from auth.users, not profiles table
