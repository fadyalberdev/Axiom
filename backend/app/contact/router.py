import html as html_lib
import logging

from fastapi import APIRouter, HTTPException
from app.config import settings
from app.mailer import send_email, EmailNotConfigured
from app.contact.schemas import ContactRequest, ContactResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def _render_contact_email(
    *,
    name: str,
    email: str,
    company: str | None,
    subject: str | None,
    message: str,
) -> str:
    """Build the HTML body for a general support enquiry. All input is escaped."""
    esc = html_lib.escape
    company_row = (
        f"<tr><td style='padding:4px 12px 4px 0;color:#6b7280'>Company</td>"
        f"<td style='padding:4px 0;font-weight:600'>{esc(company)}</td></tr>"
        if company
        else ""
    )
    topic = esc(subject) if subject else "General"
    return f"""\
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827">
  <h2 style="margin:0 0 4px">New support enquiry</h2>
  <p style="margin:0 0 16px;color:#6b7280">Topic: <strong>{topic}</strong></p>
  <table style="border-collapse:collapse;font-size:14px">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Name</td>
        <td style="padding:4px 0;font-weight:600">{esc(name)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td>
        <td style="padding:4px 0;font-weight:600">
          <a href="mailto:{esc(email)}" style="color:#2563eb">{esc(email)}</a></td></tr>
    {company_row}
  </table>
  <p style="margin:16px 0 0;font-size:14px;white-space:pre-wrap">{esc(message)}</p>
  <p style="margin:16px 0 0;color:#9ca3af;font-size:12px">
    Reply directly to this email to reach the sender. Sent via Axiom.
  </p>
</div>"""


@router.post("", response_model=ContactResponse)
async def submit_contact(body: ContactRequest):
    """Forward a general support/sales enquiry to the platform support inbox."""
    recipient = settings.support_email.strip()
    if not recipient:
        raise HTTPException(
            status_code=503,
            detail="Support contact is unavailable right now. Please try again later.",
        )

    html = _render_contact_email(
        name=body.name,
        email=body.email,
        company=body.company,
        subject=body.subject,
        message=body.message,
    )

    try:
        await send_email(
            to=recipient,
            subject=f"Support enquiry — {body.subject or 'General'}",
            html=html,
            reply_to=body.email,
        )
    except EmailNotConfigured:
        logger.error("Support enquiry not sent: email service is not configured.")
        raise HTTPException(status_code=503, detail="Email service is not configured.")
    except Exception:
        logger.exception("Failed to send support enquiry email")
        raise HTTPException(
            status_code=502,
            detail="Could not send your message. Please try again.",
        )

    return ContactResponse(sent=True)
