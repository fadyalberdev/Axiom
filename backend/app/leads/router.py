import math
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Query
from app.leads.schemas import CreateLeadRequest, LeadResponse, AdminLeadRow, AdminLeadsResponse
from app.database import supabase_admin
from app.dependencies import get_current_user
from app.admin.router import get_admin

router = APIRouter()


def _normalize_phone(phone: str) -> str:
    """Return phone in E.164 digits (no +) for wa.me URLs.

    Handles: +201XXXXXXXX  →  201XXXXXXXX
             201XXXXXXXX   →  201XXXXXXXX
             01XXXXXXXX    →  201XXXXXXXX
    """
    p = phone.strip().lstrip("+")
    if p.startswith("0"):
        p = "20" + p[1:]
    elif not p.startswith("20"):
        p = "20" + p
    return p


_TEMPLATES = {
    "whatsapp_click": "Hi, I'm {name}, I'm interested in your listing: {title} ({price} EGP).",
}


@router.post("/leads", response_model=LeadResponse)
async def create_lead(
    body: CreateLeadRequest,
    current_user: dict = Depends(get_current_user),
):
    if body.source not in _TEMPLATES:
        raise HTTPException(status_code=422, detail="Invalid source. Must be 'whatsapp_click'.")

    # Phone number doubles as the WhatsApp number; fall back accordingly.
    user_phone: str | None = current_user.get("phone") or current_user.get("whatsapp_number")
    user_name: str = current_user.get("full_name") or "A buyer"

    # Fetch listing
    try:
        listing_res = (
            supabase_admin.table("listings")
            .select("id, title, price, agency_id, owner_id, status, deleted_at")
            .eq("id", body.listing_id)
            .is_("deleted_at", "null")
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Listing not found.")

    listing = listing_res.data
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")

    # Resolve WhatsApp target
    agency_id: str | None = listing.get("agency_id")
    contact_phone: str | None = None
    is_billable = False

    if agency_id:
        try:
            ag_res = (
                supabase_admin.table("agencies")
                .select("name, phone")
                .eq("id", agency_id)
                .single()
                .execute()
            )
            if ag_res.data and ag_res.data.get("phone"):
                contact_phone = _normalize_phone(ag_res.data["phone"])
                is_billable = True
        except Exception:
            pass

    # Fall back to owner profile phone if agency had no phone (or no agency)
    if not contact_phone:
        owner_id = listing.get("owner_id")
        if owner_id:
            try:
                ow_res = (
                    supabase_admin.table("profiles")
                    .select("phone, whatsapp_number")
                    .eq("id", owner_id)
                    .single()
                    .execute()
                )
                owner_phone = (ow_res.data.get("phone") or ow_res.data.get("whatsapp_number")) if ow_res.data else None
                if owner_phone:
                    contact_phone = _normalize_phone(owner_phone)
            except Exception:
                pass

    if not contact_phone:
        raise HTTPException(status_code=422, detail="Contact information is not available for this listing.")

    # Upsert lead (ON CONFLICT DO NOTHING). contact_phone is NOT NULL, so only
    # record the lead when we have the buyer's number; the WhatsApp link is
    # always returned regardless so contacting the lister never breaks.
    already_existed = False
    if user_phone:
        lead_data = {
            "user_id": current_user["id"],
            "listing_id": body.listing_id,
            "agency_id": agency_id,
            "contact_name": user_name,
            "contact_phone": user_phone,
            "source": body.source,
            "is_billable": is_billable,
        }
        try:
            insert_res = (
                supabase_admin.table("leads")
                .upsert(lead_data, on_conflict="user_id,listing_id", ignore_duplicates=True)
                .execute()
            )
            already_existed = not bool(insert_res.data)
        except Exception:
            already_existed = True

    # Build wa.me URL
    price_str = f"{int(listing.get('price', 0)):,}"
    message = _TEMPLATES[body.source].format(
        name=user_name,
        title=listing.get("title", "the listing"),
        price=price_str,
    )
    whatsapp_url = f"https://wa.me/{contact_phone}?text={quote(message)}"

    return {"whatsapp_url": whatsapp_url, "already_existed": already_existed}


@router.get("/admin/leads", response_model=AdminLeadsResponse)
async def get_admin_leads(
    agency_id: str | None = Query(None),
    source: str | None = Query(None),
    is_billable: bool | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _admin: str = Depends(get_admin),
):
    query = (
        supabase_admin.table("leads")
        .select(
            "id, contact_name, contact_phone, source, is_billable, created_at, "
            "listings(title), agencies(name)",
            count="exact",
        )
        .order("created_at", desc=True)
    )

    if agency_id:
        query = query.eq("agency_id", agency_id)
    if source:
        query = query.eq("source", source)
    if is_billable is not None:
        query = query.eq("is_billable", is_billable)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)

    offset = (page - 1) * per_page
    result = query.range(offset, offset + per_page - 1).execute()

    rows = []
    for r in result.data or []:
        rows.append(AdminLeadRow(
            id=r["id"],
            contact_name=r["contact_name"],
            contact_phone=r["contact_phone"],
            listing_title=(r.get("listings") or {}).get("title"),
            agency_name=(r.get("agencies") or {}).get("name"),
            source=r["source"],
            is_billable=r["is_billable"],
            created_at=r["created_at"],
        ))

    total = result.count or 0
    return AdminLeadsResponse(
        data=rows,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 1,
    )
