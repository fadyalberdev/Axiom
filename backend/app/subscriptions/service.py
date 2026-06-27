"""Subscription DB layer over supabase_admin."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.database import supabase_admin

ACTIVE_LISTING_STATUSES = ["active", "pending", "reserved", "booked"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _window_expired(period_start_iso) -> bool:
    """True if the monthly AI usage window (30 days) has elapsed."""
    if not period_start_iso:
        return True
    try:
        start = datetime.fromisoformat(str(period_start_iso).replace("Z", "+00:00"))
    except ValueError:
        return True
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - start >= timedelta(days=30)


def get_or_create(user_id: str) -> dict:
    existing = (
        supabase_admin.table("subscriptions").select("*").eq("user_id", user_id).limit(1).execute()
    )
    if existing.data:
        return existing.data[0]
    created = (
        supabase_admin.table("subscriptions")
        .insert({"user_id": user_id, "plan": "free", "status": "active"})
        .execute()
    )
    return (created.data or [{}])[0]


def count_active_listings(user_id: str) -> int:
    result = (
        supabase_admin.table("listings")
        .select("id", count="exact")
        .eq("owner_id", user_id)
        .is_("deleted_at", "null")
        .in_("status", ACTIVE_LISTING_STATUSES)
        .execute()
    )
    return result.count or 0


def increment_ai_used(user_id: str) -> None:
    sub = get_or_create(user_id)
    if _window_expired(sub.get("ai_period_start")):
        used, period = 1, _now_iso()
    else:
        used, period = int(sub.get("ai_descriptions_used", 0) or 0) + 1, sub.get("ai_period_start")
    (
        supabase_admin.table("subscriptions")
        .update({"ai_descriptions_used": used, "ai_period_start": period, "updated_at": _now_iso()})
        .eq("user_id", user_id)
        .execute()
    )
