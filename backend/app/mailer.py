"""Transactional email sending via the Resend HTTP API.

Kept provider-specific but tiny: callers use `send_email(...)` and never see
Resend details. Raises `EmailNotConfigured` when no API key is set so callers
can degrade gracefully instead of 500-ing.
"""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


class EmailNotConfigured(Exception):
    """Raised when RESEND_API_KEY is unset, so email cannot be sent."""


async def send_email(
    *,
    to: str,
    subject: str,
    html: str,
    reply_to: str | None = None,
) -> None:
    """Send a transactional email via Resend.

    Raises:
        EmailNotConfigured: if no API key is configured.
        httpx.HTTPStatusError: if Resend rejects the request.
        httpx.HTTPError: on network/timeout failures.
    """
    if not settings.resend_api_key:
        raise EmailNotConfigured("RESEND_API_KEY is not set")

    payload: dict = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if reply_to:
        payload["reply_to"] = reply_to

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json=payload,
        )
    resp.raise_for_status()
    logger.info("Sent email to %s (subject=%r)", to, subject)
