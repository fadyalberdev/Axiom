from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.database import supabase_admin
from app.stripe_client import get_stripe

logger = logging.getLogger(__name__)

router = APIRouter()


def _field(source, key: str):
    if isinstance(source, dict):
        return source.get(key)
    return getattr(source, key, None)


def _epoch_to_iso(value):
    if not value:
        return None
    return datetime.fromtimestamp(int(value), tz=timezone.utc).isoformat()


def _current_period_end(obj):
    """Stripe API >=2025-03-31 (Basil) moved current_period_end off the subscription
    root onto each subscription item. Fall back to the first item when absent."""
    value = _field(obj, "current_period_end")
    if value:
        return value
    items = _field(obj, "items")
    data = _field(items, "data") if items is not None else None
    if data:
        return _field(data[0], "current_period_end")
    return None


def _sync_checkout_session(obj) -> None:
    if _field(obj, "mode") != "subscription":
        return
    md = _field(obj, "metadata") or {}
    user_id = _field(md, "user_id") or _field(obj, "client_reference_id")
    if not user_id:
        return
    plan = _field(md, "plan") or "basic"
    sub_id = _field(obj, "subscription")
    customer_id = _field(obj, "customer")
    supabase_admin.table("subscriptions").upsert({
        "user_id": user_id,
        "plan": plan,
        "status": "active",
        "stripe_subscription_id": sub_id if isinstance(sub_id, str) else None,
        "stripe_customer_id": customer_id if isinstance(customer_id, str) else None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id").execute()
    from app.subscriptions.lapse import pause_excess_for_user
    pause_excess_for_user(user_id)


def _sync_subscription(obj) -> None:
    # In stripe-python >=8, StripeObject is NOT a dict subclass, so reach into
    # metadata with _field (attribute access) rather than dict.get / isinstance(dict).
    md = _field(obj, "metadata") or {}
    user_id = _field(md, "user_id")
    if not user_id:
        return
    status = _field(obj, "status")
    plan = _field(md, "plan") or "basic"
    if status in ("canceled", "unpaid", "incomplete_expired"):
        plan, status = "free", "canceled"
    # upsert: if the subscription row doesn't exist yet (e.g. customer.subscription.created
    # fires before our own insert), create it rather than silently no-op with .update()
    supabase_admin.table("subscriptions").upsert({
        "user_id": user_id,
        "plan": plan,
        "status": status if status in ("active", "trialing", "past_due", "canceled") else "active",
        "stripe_subscription_id": _field(obj, "id"),
        "stripe_customer_id": _field(obj, "customer"),
        "current_period_end": _epoch_to_iso(_current_period_end(obj)),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id").execute()
    # Lazy import: lapse.py created in Task 6; only reached for live subscription events.
    from app.subscriptions.lapse import pause_excess_for_user
    pause_excess_for_user(user_id)


@router.post("/webhook")
async def stripe_webhook(request: Request):
    stripe = get_stripe()
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Stripe webhook secret is not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=settings.stripe_webhook_secret,
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook signature")

    event_type = _field(event, "type")
    obj = _field(_field(event, "data"), "object")
    try:
        if event_type == "checkout.session.completed":
            _sync_checkout_session(obj)
        elif event_type in (
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
        ):
            _sync_subscription(obj)
    except HTTPException:
        raise
    except Exception as e:
        # Log and return 500 so Stripe retries the webhook (up to 3 days).
        logger.error("Stripe webhook handler failed for event %s: %s", event_type, e)
        raise HTTPException(status_code=500, detail="Webhook processing failed")

    return {"received": True}
