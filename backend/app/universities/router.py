import html as html_lib
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from app.database import supabase_admin
from app.config import settings
from app.mailer import send_email, EmailNotConfigured
from app.universities.schemas import ContactUniversityRequest, ContactUniversityResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def _compute_trust_score(
    verified: bool,
    listings_count: int,
    student_count: int | None,
    founded_year: int | None,
) -> int:
    pts = 40 if verified else 0
    pts += min(listings_count * 2, 30)
    if student_count:
        pts += min(student_count // 1000, 20)
    if founded_year:
        age = max(0, datetime.now(timezone.utc).year - founded_year)
        pts += min(age // 5, 10)
    return min(pts, 100)


def _build_university_brief(row: dict, listings_count: int = 0) -> dict:
    return {
        "id": row["id"],
        "slug": row["slug"],
        "name": row["name"],
        "subtitle": (row.get("description") or "")[:100] or None,
        "logo_url": row.get("logo_url"),
        "banner_url": row.get("banner_url"),
        "verified": bool(row.get("verified", False)),
        "listings_count": listings_count,
        "city": row.get("city"),
        "type": row.get("type"),
        "student_count": row.get("student_count"),
        "accreditation": row.get("accreditation"),
        "founded_year": row.get("founded_year"),
        "website": row.get("website"),
        "phone": row.get("phone"),
        "email": row.get("email"),
        "description": row.get("description"),
        "trust_score": 0,
        "created_at": row.get("created_at"),
    }


@router.get("")
async def list_universities(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    city: str | None = Query(None),
):
    offset = (page - 1) * per_page
    query = supabase_admin.table("universities").select("*", count="exact")
    if city:
        city_safe = city.replace("%", "").replace("_", "")[:100]
        query = query.ilike("city", f"%{city_safe}%")
    query = query.order("created_at", desc=True).range(offset, offset + per_page - 1)

    try:
        result = query.execute()
    except Exception as e:
        logger.error("universities DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    enriched = []
    for uni in (result.data or []):
        try:
            count_result = (
                supabase_admin.table("listings")
                .select("id", count="exact")
                .eq("university_id", uni["id"])
                .eq("status", "active")
                .is_("deleted_at", "null")
                .execute()
            )
            listings_count = count_result.count or 0
        except Exception:
            listings_count = 0
        brief = _build_university_brief(uni, listings_count)
        brief["trust_score"] = _compute_trust_score(
            brief["verified"], listings_count, uni.get("student_count"), uni.get("founded_year")
        )
        enriched.append(brief)

    return {"universities": enriched, "total": result.count or 0, "page": page, "per_page": per_page}


@router.get("/{slug}/listings")
async def get_university_listings(
    slug: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
):
    try:
        uni_result = (
            supabase_admin.table("universities").select("id").eq("slug", slug).single().execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="University not found")

    if not uni_result.data:
        raise HTTPException(status_code=404, detail="University not found")

    university_id = uni_result.data["id"]
    offset = (page - 1) * per_page
    from app.listings.router import _build_listing_brief

    try:
        result = (
            supabase_admin.table("listings")
            .select("*, neighborhoods(name)", count="exact")
            .eq("university_id", university_id)
            .eq("status", "active")
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
        )
    except Exception as e:
        logger.error("universities DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    return {
        "listings": [_build_listing_brief(l) for l in (result.data or [])],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/{slug}")
async def get_university(slug: str):
    try:
        result = (
            supabase_admin.table("universities").select("*").eq("slug", slug).single().execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="University not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="University not found")

    uni = result.data
    from app.listings.router import _build_listing_brief

    try:
        listings_result = (
            supabase_admin.table("listings")
            .select("*, neighborhoods(name)")
            .eq("university_id", uni["id"])
            .eq("status", "active")
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        uni_listings = listings_result.data or []
    except Exception:
        uni_listings = []

    listings_count = len(uni_listings)
    trust_score = _compute_trust_score(
        bool(uni.get("verified", False)),
        listings_count,
        uni.get("student_count"),
        uni.get("founded_year"),
    )

    return {
        "id": uni["id"],
        "slug": uni["slug"],
        "name": uni["name"],
        "subtitle": (uni.get("description") or "")[:100] or None,
        "description": uni.get("description"),
        "logo_url": uni.get("logo_url"),
        "banner_url": uni.get("banner_url"),
        "verified": bool(uni.get("verified", False)),
        "listings_count": listings_count,
        "city": uni.get("city"),
        "type": uni.get("type"),
        "student_count": uni.get("student_count"),
        "accreditation": uni.get("accreditation"),
        "founded_year": uni.get("founded_year"),
        "website": uni.get("website"),
        "phone": uni.get("phone"),
        "email": uni.get("email"),
        "trust_score": trust_score,
        "created_at": uni.get("created_at"),
        "listings": [_build_listing_brief(l) for l in uni_listings],
    }


def _render_university_contact_email(
    *,
    university_name: str,
    name: str,
    email: str,
    phone: str,
    message: str | None,
) -> str:
    """Build the HTML body for a university enquiry. All user input is escaped."""
    esc = html_lib.escape
    message_block = (
        f"<p style='margin:16px 0 0;font-size:14px;white-space:pre-wrap'>{esc(message)}</p>"
        if message
        else ""
    )
    return f"""\
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827">
  <h2 style="margin:0 0 4px">New student housing enquiry</h2>
  <p style="margin:0 0 16px;color:#6b7280">
    Someone is enquiring about accommodation through <strong>{esc(university_name)}</strong> on Axiom.
  </p>
  <table style="border-collapse:collapse;font-size:14px">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Name</td>
        <td style="padding:4px 0;font-weight:600">{esc(name)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td>
        <td style="padding:4px 0;font-weight:600">
          <a href="mailto:{esc(email)}" style="color:#2563eb">{esc(email)}</a></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Phone</td>
        <td style="padding:4px 0;font-weight:600">{esc(phone)}</td></tr>
  </table>
  {message_block}
  <p style="margin:16px 0 0;color:#9ca3af;font-size:12px">
    Reply directly to this email to reach the enquirer. Sent via Axiom.
  </p>
</div>"""


@router.post("/{university_id}/contact", response_model=ContactUniversityResponse)
async def contact_university(university_id: str, body: ContactUniversityRequest):
    """Forward a university contact enquiry by email.

    Falls back to the platform support inbox when the university has no email on
    file. The enquirer's address is set as reply-to so the university can respond.
    """
    try:
        result = (
            supabase_admin.table("universities")
            .select("name, email")
            .eq("id", university_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="University not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="University not found")

    university_name = result.data.get("name") or "the university"
    recipient = (result.data.get("email") or "").strip() or settings.support_email.strip()

    if not recipient:
        raise HTTPException(
            status_code=503,
            detail="Contact is unavailable for this university right now.",
        )

    html = _render_university_contact_email(
        university_name=university_name,
        name=body.name,
        email=body.email,
        phone=body.phone,
        message=body.message,
    )

    try:
        await send_email(
            to=recipient,
            subject=f"New enquiry — {university_name}",
            html=html,
            reply_to=body.email,
        )
    except EmailNotConfigured:
        logger.error("University enquiry not sent: email service is not configured.")
        raise HTTPException(status_code=503, detail="Email service is not configured.")
    except Exception:
        logger.exception("Failed to send university enquiry email for %s", university_id)
        raise HTTPException(
            status_code=502,
            detail="Could not send your message. Please try again.",
        )

    return ContactUniversityResponse(sent=True)
