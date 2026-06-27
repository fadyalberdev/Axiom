# Stripe Booking & Auto-Payout Design

**Date:** 2026-05-28  
**Status:** Approved  
**Approach:** Option A — Stripe Connect (test mode), transfer on renter confirmation

---

## Problem

Renters need to pay upfront for a full lease (e.g. 5,000 EGP for 5 months). The platform must collect a 5% fee (250 EGP) and automatically transfer the remainder (4,750 EGP) to the property owner's Stripe Express connected account when the renter confirms the property is real.

---

## Full Payment Flow

```
[Property page /property/[id]]
  └─ BookNowButton (visible for for_rent / for_sale only, hidden for shared_housing)
       └─ BookingModal opens
            Step 1 — Details
              ├─ start date picker (rent only)
              ├─ duration selector: 1 / 2 / 3 / 6 / 12 months (rent only)
              └─ price breakdown:
                   Monthly price:  1,000 EGP
                   Duration:       × 5 months
                   Total charge:   5,000 EGP
                   Platform fee:   250 EGP (5%)
                   Owner receives: 4,750 EGP

            Step 2 — Payment
              ├─ Stripe CardElement
              └─ "Pay 5,000 EGP" button
                    │
                    ├─ POST /api/bookings/payment-intent
                    │    ← { client_secret, booking_preview }
                    │
                    └─ stripe.confirmCardPayment(client_secret)

            Step 3 — Success
              └─ redirect → /booking/[id]

[Stripe fires webhook]
  └─ POST /api/stripe/webhook
       event: payment_intent.succeeded
          │
          └─ INSERT bookings row (status = pending_confirmation)
               stripe_payment_intent_id stored

[Renter visits property → clicks "Confirm" on /booking/[id]]
  └─ POST /api/bookings/{id}/confirm
       │
       ├─ stripe.Transfer.create(
       │      amount = owner_amount_piastres,
       │      currency = "egp",
       │      destination = owner.stripe_account_id
       │  )
       ├─ booking.stripe_transfer_id = transfer.id
       ├─ booking.status → active
       └─ all disbursement rows → status = released
```

---

## Database Changes

```sql
-- Migration: 007_stripe_booking_payout.sql

-- Owner's Stripe Express connected account ID
ALTER TABLE profiles ADD COLUMN stripe_account_id TEXT;

-- Payment proof on bookings
ALTER TABLE bookings ADD COLUMN stripe_payment_intent_id TEXT;
ALTER TABLE bookings ADD COLUMN stripe_transfer_id TEXT;
```

---

## Backend Changes

### New Files

| File | Purpose |
|---|---|
| `backend/app/stripe_client.py` | Stripe singleton initialized from `settings.stripe_secret_key` |
| `backend/app/stripe_webhooks/__init__.py` | Module init |
| `backend/app/stripe_webhooks/router.py` | `POST /api/stripe/webhook` — HMAC verified, handles `payment_intent.succeeded` |

### Modified Files

| File | Change |
|---|---|
| `backend/app/config.py` | Add `stripe_secret_key: str`, `stripe_webhook_secret: str`, `stripe_publishable_key: str` |
| `backend/app/.env` | Add `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`, `STRIPE_PUBLISHABLE_KEY=pk_test_...` |
| `backend/app/bookings/router.py` | Add `POST /api/bookings/payment-intent` endpoint; update `confirm` to call Stripe transfer |
| `backend/app/main.py` | Register `stripe_webhooks` router at `/api/stripe` |

### New Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/bookings/payment-intent` | JWT required | Creates PaymentIntent, lazily creates owner Stripe account if missing, returns `client_secret` |
| `POST` | `/api/stripe/webhook` | Stripe HMAC | Handles `payment_intent.succeeded` → inserts booking row |
| `GET` | `/api/bookings/by-intent/{intent_id}` | JWT required | Frontend polls after payment to get the created booking_id |

### Owner Stripe Account (lazy creation)

On `POST /api/bookings/payment-intent`:
1. Fetch owner profile
2. If `stripe_account_id` is null → `stripe.Account.create(type="express")` in test mode
3. Store `stripe_account_id` on profiles row
4. Proceed with PaymentIntent creation

No onboarding flow required in test mode.

### PaymentIntent Metadata

All booking data stored in PaymentIntent metadata so the webhook can reconstruct the booking:

```python
metadata = {
    "listing_id": ...,
    "renter_id": ...,
    "owner_id": ...,
    "booking_type": ...,       # "rent" | "sale"
    "start_date": ...,         # ISO date or ""
    "duration_months": ...,    # str(int) or ""
    "monthly_price": ...,
    "total_price": ...,
    "platform_cut_pct": "5.0",
    "platform_cut_amount": ...,
    "owner_amount": ...,
    "owner_stripe_account_id": ...,
}
```

---

## Frontend Changes

### New Files

| File | Purpose |
|---|---|
| `frontend/src/components/booking/BookNowButton.tsx` | Button rendered on property page; hidden for `shared_housing` and non-active listings |
| `frontend/src/components/booking/BookingModal.tsx` | 3-step modal: Details → Payment (Stripe CardElement) → Success redirect |

### Modified Files

| File | Change |
|---|---|
| `frontend/src/app/property/[id]/page.tsx` | Add `<BookNowButton>` below listing details |
| `frontend/src/lib/api.ts` | Add `createPaymentIntent(body)` function |
| `frontend/package.json` | Add `@stripe/stripe-js` and `@stripe/react-stripe-js` |

### BookingModal — Step Detail

**Step 1 (Details):**
- For `for_rent`: date picker + duration dropdown (1/2/3/6/12 months) + price breakdown
- For `for_sale`: show total price only, no date/duration
- Validation: start date must be today or future

**Step 2 (Payment):**
- Wraps CardElement in `<Elements stripe={stripePromise}>`
- On submit: calls `POST /api/bookings/payment-intent` → `stripe.confirmCardPayment(client_secret)`
- Loading state on Pay button while processing

**Step 3 (Success):**
- Shows booking summary
- Frontend polls `GET /api/bookings/by-intent/{intent_id}` (max 10×, 1s apart) until booking row appears
- "View Booking" button → `/booking/[id]`

---

## Error Handling & Security

### Webhook Security
```python
# Raw bytes body — do NOT use FastAPI's JSON parsing before this
event = stripe.Webhook.construct_event(
    payload=await request.body(),
    sig_header=request.headers["stripe-signature"],
    secret=settings.stripe_webhook_secret,
)
# Any verification failure → 400, logged
```

### Idempotency
- Before inserting booking row in webhook handler, check if `stripe_payment_intent_id` already exists
- If yes → return 200 silently (webhook retry safety)

### Transfer Failure
```python
try:
    transfer = stripe.Transfer.create(...)
except stripe.error.StripeError as e:
    # Do NOT activate booking — renter can retry confirm
    raise HTTPException(status_code=502, detail=e.user_message)
```

### Abandoned PaymentIntent
- User starts checkout but closes browser → intent exists in Stripe, no booking row
- Handled naturally: webhook only fires on `payment_intent.succeeded`, not on created/cancelled

### Key Isolation
- `STRIPE_SECRET_KEY` — backend `.env` only, never exposed to frontend
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — frontend env only, safe to expose

---

## For-Sale Listings

Same flow, with differences:
- No date/duration in Step 1 — just price breakdown
- `total_price = listing.price`, `monthly_price = null`
- On confirmation: `stripe.Transfer.create(owner_amount)` + listing status → `"sold"`

---

## Test Credentials

```
Test card:        4242 4242 4242 4242  exp: any future  CVC: any
Webhook local:    stripe listen --forward-to localhost:8000/api/stripe/webhook
```

---

## What Is NOT Included

- Real bank onboarding for Egyptian owners (Egypt not in Stripe supported countries for live mode)
- Monthly scheduled payouts (all transferred at once on confirmation)
- Refunds
- Dispute handling
- SMS/email payment receipts
