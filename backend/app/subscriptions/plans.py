"""Pure plan logic for owner subscriptions. No I/O.

Caps, quotas, and prices live here. A "subscription" is a plain dict shaped like a
`public.subscriptions` row (or None for an account that never subscribed).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class PlanLimits:
    listing_cap: int
    ai_quota: int      # monthly AI-description quota
    price_egp: int     # 0 for free/trial; agency is admin-provisioned


PLANS: dict[str, PlanLimits] = {
    "free":   PlanLimits(listing_cap=1,    ai_quota=0,      price_egp=0),
    "trial":  PlanLimits(listing_cap=3,    ai_quota=50,     price_egp=0),
    "basic":  PlanLimits(listing_cap=5,    ai_quota=10,     price_egp=199),
    "pro":    PlanLimits(listing_cap=20,   ai_quota=50,     price_egp=499),
    "agency": PlanLimits(listing_cap=1000, ai_quota=100000, price_egp=0),
}

TRIAL_DAYS = 7
GRACE_DAYS = 7


def plan_limits(plan: str) -> PlanLimits:
    return PLANS.get(plan, PLANS["free"])


def _is_past(iso_value) -> bool:
    if not iso_value:
        return True
    try:
        dt = datetime.fromisoformat(str(iso_value).replace("Z", "+00:00"))
    except ValueError:
        return True
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt <= datetime.now(timezone.utc)


def effective_plan(sub: dict | None) -> str:
    """Resolve the live plan from a subscription row, honoring expiry/status."""
    if not sub:
        return "free"
    plan = sub.get("plan", "free")
    status = sub.get("status")
    if plan == "trial":
        return "free" if _is_past(sub.get("trial_ends_at")) else "trial"
    if status in ("active", "trialing"):
        return plan
    return "free"  # past_due / canceled / unknown


def listing_cap(sub: dict | None) -> int:
    return plan_limits(effective_plan(sub)).listing_cap


def ai_quota(sub: dict | None) -> int:
    return plan_limits(effective_plan(sub)).ai_quota


def ai_remaining(sub: dict | None) -> int:
    used = int((sub or {}).get("ai_descriptions_used", 0) or 0)
    return max(0, ai_quota(sub) - used)


def select_listings_to_pause(active_ids_oldest_first: list[str], cap: int) -> list[str]:
    """Keep the newest `cap` active listings; return the rest (oldest-first) to pause."""
    overflow = len(active_ids_oldest_first) - cap
    if overflow <= 0:
        return []
    return active_ids_oldest_first[:overflow]
