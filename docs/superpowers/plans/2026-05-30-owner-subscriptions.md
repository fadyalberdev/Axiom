# Owner Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner-side subscription plans (Free/Trial/Basic/Pro, agency admin-provisioned) that gate active-listing quantity and metered AI-description usage, billed via Stripe recurring into the single platform account.

**Architecture:** A `subscriptions` table holds one row per owner. Pure plan logic lives in `app/subscriptions/plans.py` (caps, quotas, effective-plan resolution, lapse selection) so it is unit-testable without the DB. A thin router exposes status/checkout/trial/cancel. The existing Stripe webhook router gains subscription-event handling. Two enforcement points (listing create, AI description) and one scheduled lapse sweep (pause excess → delete after 7-day grace) consume the pure helpers.

**Tech Stack:** FastAPI, Supabase (PostgreSQL via `supabase_admin`), Stripe Python SDK (recurring Subscriptions), pytest (mocked Supabase per `tests/conftest.py`), Next.js 16 frontend (TanStack Query + Zustand + `@/lib/api`).

**Spec:** `docs/superpowers/specs/2026-05-30-owner-subscriptions-design.md`

**Test command (all backend tasks):** from `backend/`, run `./venv/Scripts/python.exe -m pytest <path> -v`

---

## File Structure

**Backend (create):**
- `backend/sql/2026-05-30_owner_subscriptions.sql` — migration (DDL).
- `backend/app/subscriptions/__init__.py`
- `backend/app/subscriptions/plans.py` — pure plan logic (no I/O).
- `backend/app/subscriptions/service.py` — DB reads/writes for a user's subscription + usage.
- `backend/app/subscriptions/router.py` — `/api/subscriptions/*` endpoints.
- `backend/app/subscriptions/lapse.py` — pause-excess + delete-after-grace sweep.
- `backend/tests/test_subscriptions.py` — unit tests.

**Backend (modify):**
- `backend/app/config.py` — Stripe price IDs (config only; numbers live in `plans.py`).
- `backend/app/main.py` — mount subscriptions router + start lapse loop in lifespan.
- `backend/app/stripe_webhooks/router.py` — handle subscription events.
- `backend/app/listings/router.py:407` — quota gate in `create_listing`.
- `backend/app/ai/router.py:1038` — AI-quota gate in `generate_description`.
- `backend/tests/conftest.py` — add subscriptions patches.

**Frontend (modify/create):**
- `frontend/src/types/api.ts` — `Subscription`, `SubscriptionStatus` types.
- `frontend/src/lib/queries.ts` — subscription query + mutations.
- `frontend/src/app/pricing/page.tsx` — plans page (create).
- `frontend/src/components/dashboard/AddListingModal.tsx` — cap prompt.
- `frontend/src/components/dashboard/` — paused-listing banner + AI quota hint (in existing components).

---

## Task 1: Database migration

**Files:**
- Create: `backend/sql/2026-05-30_owner_subscriptions.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Owner subscriptions (revenue Layer 1).
-- Spec: docs/superpowers/specs/2026-05-30-owner-subscriptions-design.md

create type subscription_plan as enum ('free', 'trial', 'basic', 'pro', 'agency');

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id),
  plan subscription_plan not null default 'free',
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  trial_used boolean not null default false,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  ai_descriptions_used int not null default 0,
  ai_period_start timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;
create policy "own subscription read" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Lapse flow: a 'paused' listing is hidden but retained; paused_at starts the grace clock.
alter type listing_status add value if not exists 'paused';
alter table public.listings add column if not exists paused_at timestamptz;

-- Record subscription charges in the existing payments ledger.
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('reservation', 'booking_deposit', 'verification', 'application_fee', 'subscription'));
```

- [ ] **Step 2: Apply the enum-value additions first (cannot run inside a transaction)**

`ALTER TYPE ... ADD VALUE` cannot run in a transaction block. Apply these two statements
individually via the Supabase MCP `execute_sql` tool (not `apply_migration`):
- `alter type subscription_plan ... ` is part of `create type` (new type, fine in migration).
- `alter type listing_status add value if not exists 'paused';` — run standalone first.

Run standalone (MCP `execute_sql`): `alter type listing_status add value if not exists 'paused';`
Expected: `[]` (success).

- [ ] **Step 3: Apply the rest as a migration**

Apply the remaining DDL (the `create type subscription_plan`, `create table subscriptions`,
index, RLS policy, `listings.paused_at` column, and `payments_kind_check` swap) via the
Supabase MCP `apply_migration` tool, name `owner_subscriptions`.
Expected: `{"success": true}`.

- [ ] **Step 4: Verify**

Run (MCP `execute_sql`):
`select to_regclass('public.subscriptions') as t, (select count(*) from pg_enum e join pg_type ty on e.enumtypid=ty.oid where ty.typname='subscription_plan') as plan_vals;`
Expected: `t = "subscriptions"`, `plan_vals = 5`.

- [ ] **Step 5: Commit**

```bash
git add backend/sql/2026-05-30_owner_subscriptions.sql
git commit -m "feat(db): owner subscriptions migration"
```

---

## Task 2: Pure plan logic (`plans.py`)

This module has **no I/O** — pure functions over plan names and subscription dicts. It is the
testable core. All caps/quotas/prices live here as constants.

**Files:**
- Create: `backend/app/subscriptions/__init__.py` (empty)
- Create: `backend/app/subscriptions/plans.py`
- Test: `backend/tests/test_subscriptions.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_subscriptions.py
"""Unit tests for owner-subscription pure logic."""
from datetime import datetime, timedelta, timezone

from app.subscriptions import plans


def _iso(dt):
    return dt.isoformat()


def test_free_plan_caps():
    assert plans.listing_cap(None) == 1
    assert plans.ai_quota(None) == 0


def test_paid_plan_caps():
    assert plans.listing_cap({"plan": "basic", "status": "active"}) == 5
    assert plans.listing_cap({"plan": "pro", "status": "active"}) == 20
    assert plans.ai_quota({"plan": "pro", "status": "active"}) == 50


def test_canceled_subscription_falls_to_free():
    assert plans.effective_plan({"plan": "pro", "status": "canceled"}) == "free"
    assert plans.listing_cap({"plan": "pro", "status": "past_due"}) == 1


def test_active_trial_grants_trial_caps():
    future = _iso(datetime.now(timezone.utc) + timedelta(days=3))
    sub = {"plan": "trial", "status": "trialing", "trial_ends_at": future}
    assert plans.effective_plan(sub) == "trial"
    assert plans.listing_cap(sub) == 3
    assert plans.ai_quota(sub) == 50


def test_expired_trial_falls_to_free():
    past = _iso(datetime.now(timezone.utc) - timedelta(days=1))
    sub = {"plan": "trial", "status": "trialing", "trial_ends_at": past}
    assert plans.effective_plan(sub) == "free"
    assert plans.listing_cap(sub) == 1


def test_ai_remaining_never_negative():
    sub = {"plan": "basic", "status": "active", "ai_descriptions_used": 99}
    assert plans.ai_remaining(sub) == 0
    sub2 = {"plan": "basic", "status": "active", "ai_descriptions_used": 3}
    assert plans.ai_remaining(sub2) == 7


def test_select_listings_to_pause_keeps_newest():
    # oldest -> newest; cap 1 keeps the newest, pauses the rest
    ids = ["a", "b", "c", "d"]  # a oldest, d newest
    assert plans.select_listings_to_pause(ids, cap=1) == ["a", "b", "c"]
    assert plans.select_listings_to_pause(ids, cap=4) == []
    assert plans.select_listings_to_pause(ids, cap=10) == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./venv/Scripts/python.exe -m pytest tests/test_subscriptions.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.subscriptions'`.

- [ ] **Step 3: Create the package and implement `plans.py`**

```python
# backend/app/subscriptions/__init__.py
```
(empty file)

```python
# backend/app/subscriptions/plans.py
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./venv/Scripts/python.exe -m pytest tests/test_subscriptions.py -v`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/subscriptions/__init__.py backend/app/subscriptions/plans.py backend/tests/test_subscriptions.py
git commit -m "feat(subscriptions): pure plan logic + tests"
```

---

## Task 3: Subscription service (DB layer)

**Files:**
- Create: `backend/app/subscriptions/service.py`
- Test: `backend/tests/test_subscriptions.py` (append)

`service.py` wraps `supabase_admin`. `get_or_create(user_id)` returns the row, lazily creating
a `free` row. `count_active_listings(user_id)` counts non-paused, non-deleted listings.
`increment_ai_used(user_id)` bumps the metered counter (resetting the monthly window first).

- [ ] **Step 1: Write the failing test (monthly AI window reset is pure-ish, test it directly)**

```python
# append to backend/tests/test_subscriptions.py
from app.subscriptions import service


def test_should_reset_ai_window_after_a_month():
    from datetime import datetime, timedelta, timezone
    old = (datetime.now(timezone.utc) - timedelta(days=32)).isoformat()
    recent = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    assert service._window_expired(old) is True
    assert service._window_expired(recent) is False
    assert service._window_expired(None) is True
```

- [ ] **Step 2: Run to verify it fails**

Run: `./venv/Scripts/python.exe -m pytest tests/test_subscriptions.py::test_should_reset_ai_window_after_a_month -v`
Expected: FAIL — `module 'app.subscriptions.service'` has no attribute / import error.

- [ ] **Step 3: Implement `service.py`**

```python
# backend/app/subscriptions/service.py
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
```

- [ ] **Step 4: Run to verify pass**

Run: `./venv/Scripts/python.exe -m pytest tests/test_subscriptions.py -v`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/subscriptions/service.py backend/tests/test_subscriptions.py
git commit -m "feat(subscriptions): DB service layer"
```

---

## Task 4: Subscriptions router

**Files:**
- Create: `backend/app/subscriptions/router.py`
- Modify: `backend/app/main.py:23` (import) and `:85` (mount)
- Modify: `backend/tests/conftest.py:86` (add patches)

- [ ] **Step 1: Implement the router**

```python
# backend/app/subscriptions/router.py
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
```

- [ ] **Step 2: Add config fields**

In `backend/app/config.py`, after the existing `stripe_publishable_key` line (`:28`), add:

```python
    stripe_price_basic: str = ""   # Stripe recurring price id for Basic
    stripe_price_pro: str = ""     # Stripe recurring price id for Pro
```

- [ ] **Step 3: Mount the router**

In `backend/app/main.py`, add the import near the other routers (after `:20`):

```python
from app.subscriptions.router import router as subscriptions_router
```

and the mount after the stripe line (`:82`):

```python
app.include_router(subscriptions_router, prefix="/api/subscriptions", tags=["subscriptions"])
```

- [ ] **Step 4: Add test patches so the app imports under mocked Supabase**

In `backend/tests/conftest.py`, add to the `patches` list (after `:85`):

```python
        patch("app.subscriptions.service.supabase_admin", mock_admin),
        patch("app.subscriptions.router.supabase_admin", mock_admin),
```

(The `app.subscriptions.lapse` patch is added in Task 6, when that module is created.)

- [ ] **Step 5: Smoke-test that the app still boots and all tests pass**

Run: `./venv/Scripts/python.exe -m pytest tests/test_subscriptions.py tests/test_bookings.py -v`
Expected: PASS (existing + subscription tests). The app imports cleanly with the new router.

- [ ] **Step 6: Commit**

```bash
git add backend/app/subscriptions/router.py backend/app/config.py backend/app/main.py backend/tests/conftest.py
git commit -m "feat(subscriptions): /api/subscriptions router + config + wiring"
```

---

## Task 5: Stripe webhook — subscription events

**Files:**
- Modify: `backend/app/stripe_webhooks/router.py`

The webhook currently only handles `payment_intent.succeeded`. Add a handler that syncs
subscription rows on `customer.subscription.created|updated|deleted`, `invoice.paid`, and
`invoice.payment_failed`, and triggers the lapse sweep when a plan downgrades.

- [ ] **Step 1: Add the subscription sync function and dispatch**

In `backend/app/stripe_webhooks/router.py`, after the existing `_field` helper, add:

```python
from datetime import datetime, timezone

from app.database import supabase_admin


def _epoch_to_iso(value):
    if not value:
        return None
    return datetime.fromtimestamp(int(value), tz=timezone.utc).isoformat()


def _sync_subscription(obj) -> None:
    md = _field(obj, "metadata") or {}
    user_id = (md.get("user_id") if isinstance(md, dict) else None)
    if not user_id:
        return
    status = _field(obj, "status")  # active | trialing | past_due | canceled | ...
    plan = (md.get("plan") if isinstance(md, dict) else None) or "basic"
    if status in ("canceled", "unpaid", "incomplete_expired"):
        plan, status = "free", "canceled"
    supabase_admin.table("subscriptions").update({
        "plan": plan,
        "status": status if status in ("active", "trialing", "past_due", "canceled") else "active",
        "stripe_subscription_id": _field(obj, "id"),
        "stripe_customer_id": _field(obj, "customer"),
        "current_period_end": _epoch_to_iso(_field(obj, "current_period_end")),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", user_id).execute()
    # If the effective cap shrank, pause excess listings (grace clock starts).
    # Lazy import: lapse.py is created in Task 6; the webhook unit tests don't hit
    # this branch, so it imports cleanly even before that module exists.
    from app.subscriptions.lapse import pause_excess_for_user
    pause_excess_for_user(user_id)
```

> **Task order note:** this task's `_sync_subscription` references `app.subscriptions.lapse`,
> which is created in Task 6. The import is lazy (inside the function) and is only reached for
> live subscription webhook events — the unit tests in Step 3 do not trigger it, so the module
> imports fine. If you execute strictly in order, that is expected; the call path is exercised
> in Task 9 (manual) after Task 6 exists.

- [ ] **Step 2: Dispatch subscription event types in the webhook handler**

Replace the current single-type guard (the block that returns early unless
`payment_intent.succeeded`) with a dispatch. The full handler body becomes:

```python
    event_type = _field(event, "type")
    obj = _field(_field(event, "data"), "object")
    try:
        if event_type == "payment_intent.succeeded":
            from app.bookings.router import _create_booking_from_paid_intent
            _create_booking_from_paid_intent(obj)
        elif event_type in (
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
        ):
            _sync_subscription(obj)
        # invoice.paid / invoice.payment_failed update status via the subscription.updated
        # event Stripe also emits, so no extra handling is needed for the demo.
    except Exception:
        # Signature already verified; treat processing failures as permanent and return 200
        # so Stripe does not retry forever.
        pass
    return {"received": True}
```

(Keep the existing import of `_create_booking_from_paid_intent` working — move it inline as
shown, or retain the top-level import; do not duplicate it.)

- [ ] **Step 3: Run the webhook + booking tests**

Run: `./venv/Scripts/python.exe -m pytest tests/ -k "webhook or booking or subscription" -v`
Expected: PASS. (No new unit test here — the sync is DB-side; verified manually in Task 9.)

- [ ] **Step 4: Commit**

```bash
git add backend/app/stripe_webhooks/router.py
git commit -m "feat(subscriptions): sync subscription state from Stripe webhooks"
```

---

## Task 6: Lapse sweep (pause excess + delete after grace)

**Files:**
- Create: `backend/app/subscriptions/lapse.py`
- Modify: `backend/app/main.py` (start loop in lifespan)
- Test: `backend/tests/test_subscriptions.py` (append — uses the pure selector already tested)

- [ ] **Step 1: Implement `lapse.py`**

```python
# backend/app/subscriptions/lapse.py
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
        .order("created_at", desc=False)  # oldest first
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
```

- [ ] **Step 2: Start the loop in lifespan**

In `backend/app/main.py`, import (after `:18`):

```python
from app.subscriptions.lapse import lapse_sweep_loop
```

and in `lifespan` (`:28`), add a second task:

```python
    lease_task = asyncio.create_task(lease_checker_loop())
    lapse_task = asyncio.create_task(lapse_sweep_loop())
    try:
        yield
    finally:
        for task in (lease_task, lapse_task):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
```

- [ ] **Step 3: Add the conftest patch for the new module**

In `backend/tests/conftest.py`, add to the `patches` list (now that `lapse.py` exists):

```python
        patch("app.subscriptions.lapse.supabase_admin", mock_admin),
```

The pause/delete DB calls themselves are covered by manual verification (Task 9). The
selection logic is already unit-tested in Task 2 (`test_select_listings_to_pause_keeps_newest`).
No new unit test.

- [ ] **Step 4: Run the full suite**

Run: `./venv/Scripts/python.exe -m pytest tests/test_subscriptions.py tests/test_bookings.py tests/test_admin.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/subscriptions/lapse.py backend/app/main.py
git commit -m "feat(subscriptions): lapse sweep (pause excess + delete after grace)"
```

---

## Task 7: Enforcement — listing-create quota gate

**Files:**
- Modify: `backend/app/listings/router.py:407` (`create_listing`)
- Test: `backend/tests/test_subscriptions.py` (append)

- [ ] **Step 1: Write the failing test (gate is a pure check over count + cap)**

```python
# append to backend/tests/test_subscriptions.py
from fastapi import HTTPException
import pytest
from app.subscriptions import plans


def test_quota_gate_blocks_at_cap():
    # Helper under test: raises 402 when active >= cap.
    from app.listings.router import _enforce_listing_quota

    sub_free = {"plan": "free", "status": "active"}
    # at cap (1 active, free cap 1) -> blocked
    with pytest.raises(HTTPException) as exc:
        _enforce_listing_quota(active_count=1, sub=sub_free)
    assert exc.value.status_code == 402
    # under cap -> allowed (no raise)
    _enforce_listing_quota(active_count=0, sub=sub_free)
    # pro under cap
    _enforce_listing_quota(active_count=10, sub={"plan": "pro", "status": "active"})
```

- [ ] **Step 2: Run to verify it fails**

Run: `./venv/Scripts/python.exe -m pytest tests/test_subscriptions.py::test_quota_gate_blocks_at_cap -v`
Expected: FAIL — `cannot import name '_enforce_listing_quota'`.

- [ ] **Step 3: Add the gate helper and call it in `create_listing`**

In `backend/app/listings/router.py`, add the import near the top (with the other app imports):

```python
from app.subscriptions import plans, service
```

Add the helper above `create_listing` (before `:407`):

```python
def _enforce_listing_quota(active_count: int, sub: dict | None) -> None:
    cap = plans.listing_cap(sub)
    if active_count >= cap:
        raise HTTPException(
            status_code=402,
            detail=f"Listing limit reached for your plan ({cap}). Upgrade to add more listings.",
        )
```

Inside `create_listing`, immediately after the docstring (before `listing_data = ...` at `:414`):

```python
    sub = service.get_or_create(current_user["id"])
    active_count = service.count_active_listings(current_user["id"])
    _enforce_listing_quota(active_count, sub)
```

- [ ] **Step 4: Run to verify pass**

Run: `./venv/Scripts/python.exe -m pytest tests/test_subscriptions.py -v`
Expected: PASS.

- [ ] **Step 5: Confirm conftest coverage (no change needed)**

`backend/tests/conftest.py` already patches `app.listings.router.supabase_admin` (`:70`) and
`app.subscriptions.service.supabase_admin` (Task 4). The gate calls `service`, which reads the
already-patched `supabase_admin` — no new patch is required.

- [ ] **Step 6: Run full suite + commit**

Run: `./venv/Scripts/python.exe -m pytest tests/ -k "listing or subscription or booking" -v`
Expected: PASS.

```bash
git add backend/app/listings/router.py backend/tests/test_subscriptions.py
git commit -m "feat(subscriptions): enforce listing quota on create"
```

---

## Task 8: Enforcement — AI description quota gate

**Files:**
- Modify: `backend/app/ai/router.py:1038` (`generate_description`)
- Test: `backend/tests/test_subscriptions.py` (append)

- [ ] **Step 1: Write the failing test**

```python
# append to backend/tests/test_subscriptions.py
def test_ai_gate_blocks_when_exhausted():
    from app.ai.router import _enforce_ai_quota
    from fastapi import HTTPException
    import pytest

    exhausted = {"plan": "basic", "status": "active", "ai_descriptions_used": 10}
    with pytest.raises(HTTPException) as exc:
        _enforce_ai_quota(exhausted)
    assert exc.value.status_code == 402
    # remaining quota -> allowed
    _enforce_ai_quota({"plan": "pro", "status": "active", "ai_descriptions_used": 3})
```

- [ ] **Step 2: Run to verify it fails**

Run: `./venv/Scripts/python.exe -m pytest tests/test_subscriptions.py::test_ai_gate_blocks_when_exhausted -v`
Expected: FAIL — `cannot import name '_enforce_ai_quota'`.

- [ ] **Step 3: Add the gate + increment to `generate_description`**

In `backend/app/ai/router.py`, add near the top imports:

```python
from app.subscriptions import plans, service
```

Add the helper above `generate_description` (before `:1038`):

```python
def _enforce_ai_quota(sub: dict | None) -> None:
    if plans.ai_remaining(sub) <= 0:
        raise HTTPException(
            status_code=402,
            detail="AI description limit reached for your plan. Upgrade for more.",
        )
```

Inside `generate_description`, at the very start of the body (before the `ollama.health()`
check at `:1048`):

```python
    sub = service.get_or_create(current_user["id"])
    _enforce_ai_quota(sub)
```

And after a successful generation (just before each `return {...}` with english/arabic), record usage:

```python
    service.increment_ai_used(current_user["id"])
```

Place the `increment_ai_used` call once, immediately before the successful
`return {"english": ..., "arabic": ...}` at `:1103`. Do not increment on the
`AI_UNAVAILABLE` early-return or the empty fallback.

- [ ] **Step 4: Add patch + verify HTTPException is imported in ai/router**

Confirm `from fastapi import ... HTTPException` exists in `ai/router.py` (it does). In
`conftest.py`, the AI router's `supabase_admin` is already patched (`:72`); `service` reuses it.

- [ ] **Step 5: Run to verify pass**

Run: `./venv/Scripts/python.exe -m pytest tests/test_subscriptions.py -v`
Expected: PASS.

- [ ] **Step 6: Run the entire backend suite + commit**

Run: `./venv/Scripts/python.exe -m pytest -q`
Expected: the 4 pre-existing `test_ai.py` failures remain; everything else passes, including all
new subscription tests. (Do not attempt to fix the unrelated `test_ai.py` failures here.)

```bash
git add backend/app/ai/router.py backend/tests/test_subscriptions.py
git commit -m "feat(subscriptions): meter + gate AI description usage"
```

---

## Task 9: Manual backend verification (Stripe sandbox)

No code; verify the wiring end to end before frontend.

- [ ] **Step 1:** Add `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_PRO` (recurring EGP prices created in the
  Stripe dashboard) to `backend/.env`. Start the API: `./venv/Scripts/python.exe -m uvicorn app.main:app --reload`.
- [ ] **Step 2:** `stripe listen --forward-to localhost:8000/api/stripe/webhook`.
- [ ] **Step 3:** `GET /api/subscriptions/me` (with a JWT) → returns `plan: "free"`, `listing_cap: 1`.
- [ ] **Step 4:** Create 1 listing → succeeds. Create a 2nd → `402` with the upgrade message.
- [ ] **Step 5:** `POST /api/subscriptions/start-trial` → `plan: "trial"`, `listing_cap: 3`. 2nd/3rd listings now allowed.
- [ ] **Step 6:** `POST /api/subscriptions/checkout {plan:"pro"}` → open `checkout_url`, pay with `4242 4242 4242 4242`. Webhook fires → `GET /me` shows `plan: "pro"`, `listing_cap: 20`.
- [ ] **Step 7:** In Stripe dashboard cancel the subscription immediately → webhook → `GET /me` shows `free`; confirm listings beyond 1 flip to `paused` (`select status,paused_at from listings where owner_id=...`).
- [ ] **Step 8:** Generate AI descriptions until the plan quota is hit → next call returns `402`.

---

## Task 10: Frontend — types + queries

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/queries.ts`

- [ ] **Step 1: Add the API type**

In `frontend/src/types/api.ts`, add:

```typescript
export interface SubscriptionStatus {
  plan: "free" | "trial" | "basic" | "pro" | "agency";
  status: string | null;
  listing_cap: number;
  active_listings: number;
  ai_quota: number;
  ai_used: number;
  ai_remaining: number;
  trial_used: boolean;
  trial_ends_at: string | null;
  current_period_end: string | null;
}
```

- [ ] **Step 2: Add query + mutations**

In `frontend/src/lib/queries.ts` (follow the existing `createPaymentIntentMutation` pattern, using `api` from `@/lib/api`):

```typescript
import type { SubscriptionStatus } from "@/types/api";

export const subscriptionQuery = {
  queryKey: ["subscription", "me"],
  queryFn: () => api.get<SubscriptionStatus>("/api/subscriptions/me"),
};

export const startTrialMutation = {
  mutationFn: () => api.post<SubscriptionStatus>("/api/subscriptions/start-trial", {}),
};

export const checkoutMutation = {
  mutationFn: (plan: "basic" | "pro") =>
    api.post<{ checkout_url: string }>("/api/subscriptions/checkout", { plan }),
};

export const cancelSubscriptionMutation = {
  mutationFn: () => api.post<{ status: string }>("/api/subscriptions/cancel", {}),
};
```

- [ ] **Step 3: Type-check**

Run: from `frontend/`, `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/lib/queries.ts
git commit -m "feat(subscriptions): frontend types + queries"
```

---

## Task 11: Frontend — pricing page + cap/quota UI

**Files:**
- Create: `frontend/src/app/pricing/page.tsx`
- Modify: `frontend/src/components/dashboard/AddListingModal.tsx`

- [ ] **Step 1: Build `/pricing` page**

Create `frontend/src/app/pricing/page.tsx` as a `"use client"` page that:
- reads `subscriptionQuery` via `useQuery`,
- renders Free / Basic (EGP 199) / Pro (EGP 499) cards with caps + AI quota,
- highlights the current plan,
- shows a "Start 7-day free trial" button (calls `startTrialMutation`) only when `!trial_used`,
- "Upgrade" buttons call `checkoutMutation` then `window.location.href = data.checkout_url`,
- shows "Cancel plan" (calls `cancelSubscriptionMutation`) when on a paid plan.

Follow existing card/styling conventions (Tailwind classes used in dashboard components; reuse `formatEGP` from `@/lib/utils` for prices). Import `ElementType` from `react` if used.

- [ ] **Step 2: Add the cap prompt to AddListingModal**

In `frontend/src/components/dashboard/AddListingModal.tsx`, read `subscriptionQuery`. When
`active_listings >= listing_cap`, replace the submit button with an upgrade notice linking to
`/pricing` ("You've used N of N listings — upgrade to add more"). Otherwise show normal submit
and a subtle "N of M listings used" line.

- [ ] **Step 3: Type-check + manual check**

Run: from `frontend/`, `npx tsc --noEmit` → zero errors.
Run: `npm run dev`, visit `/pricing` → cards render; at-cap users see the upgrade prompt in AddListingModal.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/pricing/page.tsx frontend/src/components/dashboard/AddListingModal.tsx
git commit -m "feat(subscriptions): pricing page + listing-cap prompt"
```

---

## Task 12: Frontend — paused-listing banner + AI quota hint

**Files:**
- Modify: dashboard listing components (where the owner's listings render) and the AI
  description trigger (in `AddListingModal.tsx` or its description sub-component).

- [ ] **Step 1: Paused banner**

Where owner listings render their status, when `status === "paused"` show an amber banner:
"Hidden — subscribe to restore. Deleted after the grace period." Link to `/pricing`.

- [ ] **Step 2: AI quota hint**

On the AI "Generate description" button, read `ai_remaining` from `subscriptionQuery`. Show
"N AI generations left this month". When `ai_remaining <= 0`, disable the button and show
"AI limit reached — upgrade" linking to `/pricing`. Handle the backend `402` by surfacing the
returned `detail` message.

- [ ] **Step 3: Type-check + manual check**

Run: from `frontend/`, `npx tsc --noEmit` → zero errors.
Run: `npm run dev` → paused listing shows banner; exhausted AI shows disabled state.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/
git commit -m "feat(subscriptions): paused-listing banner + AI quota hint"
```

---

## Task 13: Docs + finish

**Files:**
- Modify: `docs/ROADMAP.md`, `docs/API_REFERENCE.md`

- [ ] **Step 1:** Add the `/api/subscriptions/*` endpoints to `docs/API_REFERENCE.md` (shapes from Task 4).
- [ ] **Step 2:** Update `docs/ROADMAP.md`: note owner subscriptions live; bump "Last updated"; add the apply-migration + Stripe price-id setup to Next Steps.
- [ ] **Step 3:** Run `npx tsc --noEmit` (frontend, zero errors) and `./venv/Scripts/python.exe -m pytest -q` (backend; only the 4 pre-existing `test_ai.py` failures remain).
- [ ] **Step 4:** Commit.

```bash
git add docs/ROADMAP.md docs/API_REFERENCE.md
git commit -m "docs: document owner subscriptions"
```

---

## Notes / decisions carried from the spec

- Agency plan is **admin-provisioned** — no self-serve checkout path (a future agency-billing spec).
- Buyer-facing AI (chat/search/recommendations/compatibility) is untouched — never gated.
- Fraud scoring (`_score_and_approve`) and amenity validation are untouched — always run.
- The sale reservation fee + flat rent deposit are **not** removed here — that is the separate
  rent/shared-deposit (Layer 2) plan, to be done next.
- The 4 failing `test_ai.py` tests are pre-existing and unrelated; do not fix them in this plan.
