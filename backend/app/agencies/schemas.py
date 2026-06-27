from pydantic import BaseModel
from typing import Optional


class CreateAgencyRequest(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None


class UpdateAgencyRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None


class SubscribeRequest(BaseModel):
    plan: str  # "starter" | "pro" | "enterprise"
    payment_method: str  # "paymob" | "fawry"
