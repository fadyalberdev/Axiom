from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    message: str
    company: Optional[str] = None
    subject: Optional[str] = None  # short context, e.g. "Agency plan enquiry"

    @field_validator("name", "message")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("This field cannot be empty.")
        return v.strip()


class ContactResponse(BaseModel):
    sent: bool
