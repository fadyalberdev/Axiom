from pydantic import BaseModel
from typing import Optional


class CreateLeadRequest(BaseModel):
    listing_id: str
    source: str  # "whatsapp_click"


class LeadResponse(BaseModel):
    whatsapp_url: str
    already_existed: bool


class AdminLeadRow(BaseModel):
    id: str
    contact_name: str
    contact_phone: str
    listing_title: Optional[str] = None
    agency_name: Optional[str] = None
    source: str
    is_billable: bool
    created_at: str


class AdminLeadsResponse(BaseModel):
    data: list[AdminLeadRow]
    total: int
    page: int
    per_page: int
    total_pages: int
