from __future__ import annotations

import stripe
from fastapi import HTTPException

from app.config import settings


def get_stripe() -> stripe:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    stripe.api_key = settings.stripe_secret_key
    return stripe
