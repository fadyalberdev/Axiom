# AXIOM V2 — Pre-Launch Finalization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all remaining pre-launch gaps — DB migrations, Stripe setup, shared housing booking, deployment infrastructure, and QA.

**Architecture:** Split into user-action tasks (DB/Stripe) and code tasks (shared housing feature + deployment configs). User-action tasks provide exact commands. Code tasks follow TDD. Order: DB first (prerequisite), then code changes, then deployment, then QA.

**Tech Stack:** Next.js 16, FastAPI/Python 3.12, Supabase, Stripe, Railway (backend), Vercel (frontend), GitHub Actions (CI)

---

## Task 1 (USER ACTION): Apply SQL Migrations

**Files:**

- Run in order in Supabase SQL editor: all 5 files in `backend/sql/`

All migrations use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` — idempotent, safe to re-run.

- [ ] **Step 1: Open Supabase SQL editor**

Go to https://supabase.com/dashboard → your project → SQL Editor.

- [ ] **Step 2: Run migration 1 — bookings + applications**

Paste and run the full contents of `backend/sql/2026-05-15_all_new_features.sql`.

Creates: `bookings`, `booking_disbursements` tables; adds `lifestyle_data` + `compatibility_reasons` to `listing_applications`.

- [ ] **Step 3: Run migration 2 — profile columns + avatar bucket**

Paste and run `backend/sql/2026-05-16_profile_whatsapp_and_avatars.sql`.

Adds: `whatsapp_number`, `birth_date` to `profiles`; creates `avatars` storage bucket + policies.

- [ ] **Step 4: Run migration 3 — Stripe columns on bookings**

Paste and run `backend/sql/2026-05-28_stripe_booking_payout.sql`.

Adds: `stripe_payment_intent_id`, `stripe_transfer_id` to `bookings`; `stripe_account_id` to `profiles`.

- [ ] **Step 5: Run migration 4 — payments table + listing status values**

Paste and run `backend/sql/2026-05-29_payment_fees_model.sql`.

Adds: `reserved`/`booked` values to `listing_status` enum; creates `payments` table.

- [ ] **Step 6: Run migration 5 — subscriptions + paused_at**

Paste and run `backend/sql/2026-05-30_owner_subscriptions.sql`.

Creates: `subscriptions` table with RLS; adds `paused_at` to `listings`; updates `payments_kind_check` constraint to include `'subscription'`.

- [ ] **Step 7: Verify tables exist**

In Supabase SQL editor run:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('bookings','booking_disbursements','payments','subscriptions');
```

Expected: 4 rows returned.

---

## Task 2 (USER ACTION): Rotate Stripe Keys

Old Stripe test keys may exist in git history (pre-.env commit). Any key ever committed must be rotated even if since removed from code.

- [ ] **Step 1: Identify leaked key prefixes**

Run from repo root:

```bash
git log --all -p -- "*.env" "*.env.*" | grep -E "sk_test_|pk_test_" | head -20
```

If output is empty, skip rotation — keys were never committed.

- [ ] **Step 2: Rotate secret key in Stripe dashboard**

Go to https://dashboard.stripe.com/test/apikeys → "Roll secret key" on the `sk_test_…` key. Copy the new key.

- [ ] **Step 3: Update backend/.env**

Replace the old `STRIPE_SECRET_KEY` value:

```
STRIPE_SECRET_KEY=sk_test_<new_key_here>
```

- [ ] **Step 4: Rotate webhook secret (if forwarding endpoint exists)**

If you have a Stripe webhook endpoint registered in the dashboard, go to Webhooks → your endpoint → "Reveal" the signing secret. Copy it.

Update `backend/.env`:

```
STRIPE_WEBHOOK_SECRET=whsec_<new_secret_here>
```

- [ ] **Step 5: Verify backend starts with new keys**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

Expected: server starts, no `stripe` import errors in console.

---

## Task 3 (USER ACTION): Configure Stripe Subscription Prices + Update .env

- [ ] **Step 1: Create Basic price in Stripe dashboard**

Go to https://dashboard.stripe.com/test/products → "Add product":

- Name: `AXIOM Basic`
- Pricing: Recurring, `199.00 EGP`, monthly
- Save → copy the Price ID (starts with `price_`)

- [ ] **Step 2: Create Pro price in Stripe dashboard**

Add another product:

- Name: `AXIOM Pro`
- Pricing: Recurring, `499.00 EGP`, monthly
- Save → copy the Price ID

- [ ] **Step 3: Add price IDs to backend/.env**

```
STRIPE_PRICE_BASIC=price_<basic_id_here>
STRIPE_PRICE_PRO=price_<pro_id_here>
```

- [ ] **Step 4: Set FRONTEND_URL in backend/.env**

For local dev:

```
FRONTEND_URL=http://localhost:3000
```

For production (fill in after deploying):

```
FRONTEND_URL=https://your-vercel-domain.vercel.app
```

- [ ] **Step 5: Verify subscription checkout endpoint works**

With backend running, open Pricing page at http://localhost:3000/pricing → click "Basic" → should redirect to Stripe Checkout. If you see "Subscription pricing is not configured", the price IDs are not set.

---

## Task 4 (CODE): Make Shared Housing Bookable

**Files:**

- Modify: `frontend/src/components/booking/BookNowButton.tsx`
- Modify: `backend/app/bookings/router.py` — `_compute_fee` function (~line 195)
- Modify: `backend/tests/test_bookings.py` — add shared_housing test cases

Shared housing uses the same flat booking deposit model as for_rent (EGP 2000). The `booking_type` stays `"rent"`. The backend just needs to permit `shared_housing` category alongside `for_rent`.

- [x] **Step 1: Write failing test — shared_housing accepted by \_compute_fee**

Add to `backend/tests/test_bookings.py` after `test_compute_fee_rent_is_flat_deposit`:

```python
def test_compute_fee_shared_housing_is_flat_deposit():
    """Shared housing uses same flat deposit model as for_rent."""
    listing = {"category": "shared_housing", "price": 3000}
    body = CreatePaymentIntentRequest(
        listing_id="x", booking_type="rent", start_date=date(2026, 6, 1), duration_months=3
    )
    values = _compute_fee(body, listing)
    assert values["fee"] == 2000
    assert values["kind"] == "booking_deposit"
    assert values["monthly_price"] == 3000
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_bookings.py::test_compute_fee_shared_housing_is_flat_deposit -v
```

Expected: `FAILED` — `HTTPException` raised because category != "for_rent".

- [x] **Step 3: Update \_compute_fee to allow shared_housing**

In `backend/app/bookings/router.py`, find `_compute_fee` (~line 207):

Change:

```python
    if listing.get("category") != "for_rent":
        raise HTTPException(status_code=400, detail="Rent bookings require a rental listing")
```

To:

```python
    if listing.get("category") not in ("for_rent", "shared_housing"):
        raise HTTPException(status_code=400, detail="Rent bookings require a rental or shared housing listing")
```

- [x] **Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_bookings.py -v
```

Expected: all tests pass including the new shared_housing test.

- [x] **Step 5: Write failing test — category_mismatch still rejects for_sale**

This test already exists: `test_compute_fee_rejects_category_mismatch`. Confirm it still passes after the change (it uses `for_sale` category, which must still raise).

```bash
cd backend && python -m pytest tests/test_bookings.py::test_compute_fee_rejects_category_mismatch -v
```

Expected: PASS.

- [x] **Step 6: Update BookNowButton.tsx to show button for shared_housing**

In `frontend/src/components/booking/BookNowButton.tsx`, find (~line 26):

```typescript
if (
  isOwner ||
  listing.category === "for_sale" ||
  listing.category === "shared_housing"
)
  return null;
```

Change to:

```typescript
if (isOwner || listing.category === "for_sale") return null;
```

- [x] **Step 7: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors.

- [x] **Step 8: Commit**

```bash
git add backend/app/bookings/router.py backend/tests/test_bookings.py frontend/src/components/booking/BookNowButton.tsx
git commit -m "feat: make shared_housing listings bookable with flat deposit

Same EGP 2000 deposit model as for_rent. BookNowButton now shows
for shared_housing category; _compute_fee permits the category."
```

---

## Task 5 (CODE): Deployment Infrastructure

**Files:**

- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `backend/railway.toml`
- Create: `.github/workflows/ci.yml`

Vercel handles the frontend automatically when the root directory is set to `frontend/` in the Vercel project settings — no `vercel.json` is needed unless overriding build commands.

- [x] **Step 1: Create backend/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [x] **Step 2: Create backend/.dockerignore**

```
__pycache__/
*.pyc
*.pyo
.env
.env.*
venv/
.venv/
tests/
.pytest_cache/
*.egg-info/
```

- [x] **Step 3: Create backend/railway.toml**

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

- [x] **Step 4: Add /api/health endpoint to backend**

In `backend/app/main.py`, add after the last router include (before `if __name__`):

```python
from fastapi import APIRouter as _AR
_health = _AR()

@_health.get("/api/health")
def health_check():
    return {"status": "ok"}

app.include_router(_health)
```

- [x] **Step 5: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r requirements.txt
      - run: pip install pytest pytest-asyncio
      - name: Run backend tests
        env:
          SUPABASE_URL: http://localhost
          SUPABASE_ANON_KEY: dummy
          SUPABASE_SERVICE_ROLE_KEY: dummy
          JWT_SECRET: test-secret
          FRONTEND_URL: http://localhost:3000
        run: python -m pytest tests/ -v --tb=short

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - name: TypeScript check
        run: npx tsc --noEmit
```

- [x] **Step 6: Verify CI config is valid YAML**

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`.

- [x] **Step 7: Run backend tests locally to confirm they pass before CI**

```bash
cd backend && python -m pytest tests/ -v --tb=short
```

Expected: all pass (or document which tests need env skip).

- [x] **Step 8: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore backend/railway.toml backend/app/main.py .github/workflows/ci.yml
git commit -m "feat: add deployment infrastructure

Railway Dockerfile + config for backend; GitHub Actions CI runs
backend pytest + frontend tsc on every push to main."
```

---

## Task 6 (USER ACTION + MANUAL QA): End-to-End QA Checklist

Run after Tasks 1–5 are complete and backend is running locally.

### Setup

- [ ] **Step 1: Start backend**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 2: Start Stripe CLI webhook forwarder**

```bash
stripe listen --forward-to localhost:8000/api/stripe/webhook
```

Copy the `whsec_…` signing secret printed by the CLI. Update `STRIPE_WEBHOOK_SECRET` in `backend/.env` if it differs.

- [ ] **Step 3: Start frontend**

```bash
cd frontend && npm run dev
```

### Subscription QA

- [ ] **Step 4: Free tier listing cap**

1. Log in as a user with no active listings.
2. POST to `http://localhost:8000/api/subscriptions/me` — confirm `listing_cap: 1`, `plan: "free"`.
3. Create a listing via dashboard → it becomes active.
4. Try to create a second listing → should get `402` from `/api/listings` (quota exceeded).

- [ ] **Step 5: Trial activation**

1. On Pricing page, click "Start Free Trial".
2. GET `/api/subscriptions/me` → `plan: "trial"`, `trial_used: true`, `listing_cap: 3`.
3. Create 2 more listings → both succeed.
4. Create a 4th listing → should be blocked (cap=3).

- [ ] **Step 6: Basic checkout + webhook sync**

1. On Pricing page, click "Upgrade to Basic".
2. Complete Stripe checkout with test card `4242 4242 4242 4242`, exp `12/30`, CVC `123`.
3. Watch Stripe CLI — should see `customer.subscription.created` event forwarded and `200` returned.
4. GET `/api/subscriptions/me` → `plan: "basic"`, `listing_cap: 5`.

- [ ] **Step 7: Subscription cancel**

1. POST `/api/subscriptions/cancel`.
2. In Stripe dashboard, subscription should show `cancel_at_period_end: true`.
3. After period ends (simulate with Stripe CLI `stripe subscriptions update … --cancel-at-period-end`), webhook fires `customer.subscription.deleted`.
4. GET `/api/subscriptions/me` → `plan: "free"`.

### Booking QA

- [ ] **Step 8: Rent booking flow (for_rent listing)**

1. Create an active `for_rent` listing as owner.
2. Log in as a different user (not the owner).
3. Open listing page → "Book Property" button should be visible.
4. Click → BookingModal opens → select start date + duration → proceed to payment.
5. Enter test card `4242 4242 4242 4242` → confirm.
6. Stripe CLI shows `payment_intent.succeeded` → `200`.
7. Redirect to `/booking/<id>` or dashboard — booking should appear with status `pending_confirmation`.
8. Click "Confirm booking" → status changes to `active`.

- [ ] **Step 9: Shared housing booking flow**

1. Create an active `shared_housing` listing as owner.
2. Log in as a different user.
3. Open listing page → "Book Property" button should be visible (was previously hidden).
4. Complete booking flow same as Step 8.
5. Booking created with `booking_type: "rent"`, `platform_cut_pct: 100`.

- [ ] **Step 10: Cancel + refund**

1. With a `pending_confirmation` booking, click "Cancel booking".
2. Booking status → `cancelled`.
3. Listing status → `active` (re-listed).
4. Stripe CLI shows refund event.
5. GET `/api/bookings/<id>` → `status: "cancelled"`.

---

## Deployment Steps (after QA passes)

### Deploy Backend to Railway

1. Create new Railway project → "Deploy from GitHub repo" → select `AXIOM-V2`.
2. Set root directory to `backend/`.
3. Add all env vars from `backend/.env` in Railway "Variables" tab:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`, `ADMIN_JWT_SECRET`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`
   - `FRONTEND_URL` (set to Vercel domain after frontend is deployed)
4. Deploy → confirm `/api/health` returns `{"status": "ok"}`.
5. In Stripe dashboard → Webhooks → add endpoint: `https://<railway-domain>/api/stripe/webhook` with events: `payment_intent.succeeded`, `payment_intent.canceled`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
6. Copy the new webhook signing secret → update `STRIPE_WEBHOOK_SECRET` env var on Railway.

### Deploy Frontend to Vercel

1. Import `AXIOM-V2` repo on vercel.com.
2. Set **Root Directory** to `frontend`.
3. Add env vars:
   - `NEXT_PUBLIC_API_URL=https://<railway-domain>`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
4. Deploy → confirm site loads at the Vercel domain.
5. Update Railway `FRONTEND_URL` with the Vercel domain.
