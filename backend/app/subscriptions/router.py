from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.database import supabase_admin
from app.stripe_client import get_stripe
from app.config import settings
from app.subscriptions import plans, service

router = APIRouter()


class CheckoutRequest(BaseModel):
    plan: str  # "basic" | "pro"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/me")
async def my_subscription(current_user: dict = Depends(get_current_user)):
    sub = service.get_or_create(current_user["id"])
    effective = plans.effective_plan(sub)
    return {
        "plan": effective,
        "status": sub.get("status"),
        "listing_cap": plans.listing_cap(sub),
        "active_listings": service.count_active_listings(current_user["id"]),
        "ai_quota": plans.ai_quota(sub),
        "ai_used": int(sub.get("ai_descriptions_used", 0) or 0),
        "ai_remaining": plans.ai_remaining(sub),
        "trial_used": bool(sub.get("trial_used")),
        "trial_ends_at": sub.get("trial_ends_at"),
        "current_period_end": sub.get("current_period_end"),
    }


@router.post("/start-trial")
async def start_trial(current_user: dict = Depends(get_current_user)):
    sub = service.get_or_create(current_user["id"])
    if sub.get("trial_used"):
        raise HTTPException(status_code=409, detail="Trial already used")
    ends = (datetime.now(timezone.utc) + timedelta(days=plans.TRIAL_DAYS)).isoformat()
    (
        supabase_admin.table("subscriptions")
        .update({"plan": "trial", "status": "trialing", "trial_used": True,
                 "trial_ends_at": ends, "updated_at": _now_iso()})
        .eq("user_id", current_user["id"])
        .execute()
    )
    return await my_subscription(current_user)


@router.post("/checkout")
async def checkout(body: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    if body.plan not in ("basic", "pro"):
        raise HTTPException(status_code=400, detail="plan must be basic or pro")
    price_id = {"basic": settings.stripe_price_basic, "pro": settings.stripe_price_pro}[body.plan]
    if not price_id:
        raise HTTPException(status_code=503, detail="Subscription pricing is not configured")
    stripe = get_stripe()
    try:
        sess = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.frontend_url}/dashboard?sub=success",
            cancel_url=f"{settings.frontend_url}/pricing?sub=cancel",
            client_reference_id=current_user["id"],
            metadata={"user_id": current_user["id"], "plan": body.plan},
            subscription_data={"metadata": {"user_id": current_user["id"], "plan": body.plan}},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"checkout_url": sess.url}


@router.post("/cancel")
async def cancel(current_user: dict = Depends(get_current_user)):
    sub = service.get_or_create(current_user["id"])
    sub_id = sub.get("stripe_subscription_id")
    if sub_id:
        stripe = get_stripe()
        try:
            stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))
    return {"status": "cancel_scheduled"}
