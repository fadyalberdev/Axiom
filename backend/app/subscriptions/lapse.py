"""Pause listings over the plan cap; delete still-uncovered paused listings after grace."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from app.database import supabase_admin
from app.subscriptions import plans, service


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def pause_excess_for_user(user_id: str) -> list[str]:
    """Pause the oldest active listings beyond the user's current cap. Returns paused ids."""
    sub = service.get_or_create(user_id)
    cap = plans.listing_cap(sub)
    rows = (
        supabase_admin.table("listings")
        .select("id, created_at")
        .eq("owner_id", user_id)
        .is_("deleted_at", "null")
        .in_("status", service.ACTIVE_LISTING_STATUSES)
        .order("created_at", desc=False)
        .execute()
    ).data or []
    to_pause = plans.select_listings_to_pause([r["id"] for r in rows], cap)
    for listing_id in to_pause:
        supabase_admin.table("listings").update(
            {"status": "paused", "paused_at": _now_iso(), "updated_at": _now_iso()}
        ).eq("id", listing_id).execute()
    return to_pause


def delete_expired_paused_once() -> None:
    """Soft-delete paused listings whose grace window has elapsed."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=plans.GRACE_DAYS)).isoformat()
    rows = (
        supabase_admin.table("listings")
        .select("id")
        .eq("status", "paused")
        .lt("paused_at", cutoff)
        .is_("deleted_at", "null")
        .execute()
    ).data or []
    for r in rows:
        supabase_admin.table("listings").update(
            {"deleted_at": _now_iso(), "updated_at": _now_iso()}
        ).eq("id", r["id"]).execute()


async def lapse_sweep_loop() -> None:
    while True:
        try:
            delete_expired_paused_once()
        except Exception:
            pass
        await asyncio.sleep(60 * 60 * 24)
