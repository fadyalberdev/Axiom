from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional


class ContactUniversityRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    message: Optional[str] = None

    @field_validator("name", "phone")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("This field cannot be empty.")
        return v.strip()


class ContactUniversityResponse(BaseModel):
    sent: bool


class CreateUniversityRequest(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    founded_year: Optional[int] = None
    type: Optional[str] = None
    student_count: Optional[int] = None
    accreditation: Optional[str] = None


class UpdateUniversityRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    founded_year: Optional[int] = None
    type: Optional[str] = None
    student_count: Optional[int] = None
    accreditation: Optional[str] = None
    verified: Optional[bool] = None
