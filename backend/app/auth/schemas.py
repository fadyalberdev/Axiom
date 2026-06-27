from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Any


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    country_code: Optional[str] = None
    gender: Optional[str] = None  # "male" | "female"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    country_code: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    age: Optional[int] = None
    occupation: Optional[str] = None
    lifestyle_preferences: Optional[dict[str, Any]] = None


class ProfileResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    bio: Optional[str] = None
    role: str
    is_verified_seller: bool
    gender: Optional[str] = None
    country_code: Optional[str] = None
    badges: list[str] = []
    birth_date: Optional[str] = None
    age: Optional[int] = None
    occupation: Optional[str] = None
    lifestyle_preferences: Optional[dict[str, Any]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SendPhoneOTPRequest(BaseModel):
    phone: str  # E.164 format: +201234567890


class VerifyPhoneOTPRequest(BaseModel):
    phone: str
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
