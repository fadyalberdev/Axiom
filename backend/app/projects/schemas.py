from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional


class ContactSalesRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    interested_in: Optional[str] = None

    @field_validator("name", "phone")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("This field cannot be empty.")
        return v.strip()


class ContactSalesResponse(BaseModel):
    sent: bool
