import html as html_lib
import logging

from fastapi import APIRouter, HTTPException
from app.database import supabase_admin
from app.config import settings
from app.mailer import send_email, EmailNotConfigured
from app.projects.schemas import ContactSalesRequest, ContactSalesResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{project_id}")
async def get_project(project_id: str):
    """Return project detail with agency info."""
    try:
        result = (
            supabase_admin.table("projects")
            .select("*, agencies(name, slug, logo_url, verified)")
            .eq("id", project_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Project not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    p = result.data
    agency = p.get("agencies") or {}

    return {
        "id": p["id"],
        "agency_id": p["agency_id"],
        "title": p["title"],
        "subtitle": (p.get("description") or "")[:100] or None,
        "image_url": p.get("image_url"),
        "completion_pct": p.get("completion_pct", 0),
        "starting_price": float(p["starting_price"]) if p.get("starting_price") is not None else None,
        "status": p.get("status", "planned"),
        "key_features": p.get("key_features") or [],
        "gallery_images": p.get("gallery_images") or [],
        "brochure_url": p.get("brochure_url"),
        "description": p.get("description"),
        "units_total": p.get("units_total"),
        "created_at": p.get("created_at"),
        "agency_name": agency.get("name"),
        "agency_slug": agency.get("slug"),
        "agency_logo": agency.get("logo_url"),
        "agency_verified": bool(agency.get("verified", False)),
    }


def _render_contact_email(
    *,
    project_title: str,
    name: str,
    email: str,
    phone: str,
    interested_in: str | None,
) -> str:
    """Build the HTML body for a sales enquiry. All user input is escaped."""
    esc = html_lib.escape
    interest_row = (
        f"<tr><td style='padding:4px 12px 4px 0;color:#6b7280'>Interested in</td>"
        f"<td style='padding:4px 0;font-weight:600'>{esc(interested_in)}</td></tr>"
        if interested_in
        else ""
    )
    return f"""\
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827">
  <h2 style="margin:0 0 4px">New sales enquiry</h2>
  <p style="margin:0 0 16px;color:#6b7280">
    A prospective buyer is interested in <strong>{esc(project_title)}</strong>.
  </p>
  <table style="border-collapse:collapse;font-size:14px">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Name</td>
        <td style="padding:4px 0;font-weight:600">{esc(name)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td>
        <td style="padding:4px 0;font-weight:600">
          <a href="mailto:{esc(email)}" style="color:#2563eb">{esc(email)}</a></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Phone</td>
        <td style="padding:4px 0;font-weight:600">{esc(phone)}</td></tr>
    {interest_row}
  </table>
  <p style="margin:16px 0 0;color:#9ca3af;font-size:12px">
    Reply directly to this email to reach the buyer. Sent via Axiom.
  </p>
</div>"""


@router.post("/{project_id}/contact", response_model=ContactSalesResponse)
async def contact_sales(project_id: str, body: ContactSalesRequest):
    """Forward a 'Contact Sales Team' enquiry to the project's agency by email.

    Falls back to the platform support inbox when the agency has no email on
    file. The buyer's address is set as reply-to so the agency can respond.
    """
    try:
        result = (
            supabase_admin.table("projects")
            .select("title, agencies(name, email)")
            .eq("id", project_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Project not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project_title = result.data.get("title") or "your project"
    agency = result.data.get("agencies") or {}
    recipient = (agency.get("email") or "").strip() or settings.support_email.strip()

    if not recipient:
        raise HTTPException(
            status_code=503,
            detail="Sales contact is unavailable for this project right now.",
        )

    html = _render_contact_email(
        project_title=project_title,
        name=body.name,
        email=body.email,
        phone=body.phone,
        interested_in=body.interested_in,
    )

    try:
        await send_email(
            to=recipient,
            subject=f"New sales enquiry — {project_title}",
            html=html,
            reply_to=body.email,
        )
    except EmailNotConfigured:
        logger.error("Sales enquiry not sent: email service is not configured.")
        raise HTTPException(status_code=503, detail="Email service is not configured.")
    except Exception:
        logger.exception("Failed to send sales enquiry email for project %s", project_id)
        raise HTTPException(
            status_code=502,
            detail="Could not send your message. Please try again.",
        )

    return ContactSalesResponse(sent=True)
