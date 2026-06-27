# AXIOM Payment & Monetization Model

**Date:** 2026-05-29
**Status:** Plan / spec (no code yet)
**Scope:** Graduation demo. Stripe sandbox retained. No local-PSP swap.
**Supersedes the money logic in:** `2026-05-28-stripe-booking-payout-design.md` (escrow + Connect payout — dropped for Egypt).

---

## 1. Core idea

AXIOM does **not** sell full properties online. It monetizes **commitment, trust, and workflow** — the gap Egyptian incumbents (Aqarmap, dubizzle, Property Finder) leave open by handing the deal off to phone/WhatsApp and never owning the money.

**Key technical decision that fixes the current breakage:**

> Charge small fees **to the platform only**. No owner payout → **no Stripe Connect** → no EGP transfer problem. The flow that broke (owner Express account + `Transfer.create` capability error) disappears because we stop doing the thing Egypt doesn't support.

Single platform Stripe account. Every charge lands in AXIOM's balance. Owners are paid offline (sale) or out of scope for the demo (rent collection deferred to future work).

### Locked decisions (this build)

- **Sale reservation fee** = `1% of price, capped at EGP 50,000`.
- **Owner payout / monthly rent collection** = **skipped for demo** (future-work slide). Rent = booking deposit only, kept by platform.
- **Stripe Connect** = removed entirely. Single platform account.

---

## 2. What we DON'T do (and why)

- ❌ **Full sale-price checkout.** House = millions EGP. Stripe per-charge cap ~999,999.99. Deal cycles too long.
- ❌ **Long-hold escrow.** Stripe has no true escrow. Card auth dies in 7–30 days; deals take longer.
- ❌ **Own wallet / hold + transfer funds.** Egypt CBE PSP law (in force 2025-06-17) requires a license. AXIOM stays a marketplace orchestrator, not a shadow bank.
- ❌ **Stripe Connect separate-charges-and-transfers for owner payout.** Not supported for Egypt — root cause of the prior broken payout.

---

## 3. Revenue layers → payment events

| Layer              | Who pays     | What                        | Stripe object | Lands in       | Demo?       |
| ------------------ | ------------ | --------------------------- | ------------- | -------------- | ----------- |
| 1 Subscriptions    | owner/agency | monthly plan                | Subscription  | platform       | future-work |
| 2 Trust            | owner/agency | one-time verification fee   | PaymentIntent | platform       | Phase B     |
| 3a Rent booking    | seeker       | booking deposit (flat)      | PaymentIntent | platform       | **Phase A** |
| 3b Rent collection | tenant       | monthly rent                | recurring     | platform→owner | **skipped** |
| 3c Shared housing  | seeker       | room-hold + application fee | PaymentIntent | platform       | Phase B     |
| 4 Finance          | nobody       | referral lead only          | none          | partner        | future-work |
| 5 Payout premium   | owner        | add-ons                     | —             | platform       | future-work |
| Sale reservation   | buyer        | 1% capped 50k               | PaymentIntent | platform       | **Phase A** |

---

## 4. Use cases & scenarios

### UC-1 — Reserve a SALE listing

- Buyer pays **reservation fee = min(price × 1%, 50,000) EGP**.
- On success: listing status → `reserved`. Buyer sees "Reserved — agent will contact you for documents & financing."
- No owner transfer. Sale closes offline.
- **Scenario:** price 4,000,000 → fee 40,000. price 8,000,000 → fee capped 50,000. Pay → `reserved` (hold 7 days) → offline follow-up → converts or expires.

### UC-2 — Book a RENT listing

- Seeker pays **booking deposit** (flat config fee, e.g. EGP 2,000).
- On success: listing status → `booked`. Platform keeps the fee.
- No monthly collection, no owner payout in demo.
- **Scenario:** Seeker pays deposit → owner confirms → tenancy proceeds offline.

### UC-3 — Shared-housing room hold _(Phase B)_

- Seeker pays **application fee + room-hold deposit** → room held X days.

### UC-4 — Owner buys verification _(Phase B)_

- Owner pays one-time fee → enters doc-review queue → admin approves → `is_verified_seller = true` + "fraud-screened" flag. Free badge stays as weak signal; paid tier = the real thing.

### UC-5 — Finance referral _(future-work)_

- Buyer clicks "Check mortgage" → lead form → routed to mock partner (CIB/Contact). No charge. Records referral.

### UC-6 — Cancel / refund

- Before owner confirms / within hold window → user cancels → Stripe refund of the fee/deposit → listing status reverts to `active`.

---

## 5. Code changes

### Remove

- `stripe.Account.create` (Express) — `backend/app/bookings/router.py:399`
- `stripe.Transfer.create`, `_create_owner_transfer`, `_is_transfer_capability_error`, capability-error swallow — `:61–78`, `:574–589`
- Full-lease-upfront (rent) and full-price (sale) charge logic in `_compute_booking_values`
- Free no-payment path `POST /api/bookings` (`create_booking`) — or gate behind payment
- `profiles.stripe_account_id` reads (keep column, leave unused)
- Monthly disbursement generation (`booking_disbursements` build loops) — out of demo scope

### Change

- `_compute_booking_values` → returns the **fee/deposit/reservation** amount, not full price:
  - sale → `reservation_fee = min(round(price * 0.01, 2), 50000)`
  - rent → `booking_fee = RENT_BOOKING_FEE` (flat)
- `PaymentIntent.create` → amount = the small fee, `currency="egp"`, **no `destination`, no Connect**, add idempotency key
- Listing status enum: add `reserved` (sale), `booked` (rent). Stop jumping to `sold`.
- Confirm flow → status update only; no transfer, no disbursement
- Webhook → on `payment_intent.succeeded`, record payment + set listing status; return 200 on permanent errors (no infinite retry)

### Add

- Config (`backend/app/config.py`): `RENT_BOOKING_FEE`, `SALE_RESERVATION_PCT = 0.01`, `SALE_RESERVATION_CAP = 50000`, (`VERIFICATION_FEE` Phase B)
- `POST /api/bookings/{id}/refund` (or cancel) → `stripe.Refund.create`, revert listing status
- Verification payment endpoint _(Phase B)_

### DB (new migration)

```sql
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  listing_id uuid references public.listings(id),
  kind text not null,          -- reservation | booking_deposit | verification | application_fee
  amount numeric not null,
  currency text not null default 'egp',
  stripe_payment_intent_id text unique,
  status text not null default 'pending',  -- pending|succeeded|refunded|failed
  created_at timestamptz default now(),
  refunded_at timestamptz
);

-- listings.status check: add 'reserved', 'booked'
-- bookings.total_price now stores the fee/deposit, not full price
```

### Frontend (`BookingModal.tsx`)

- Price breakdown shows **fee/deposit**, not full price + platform-cut + owner-amount.
- Sale copy: "Reservation fee (1%, capped EGP 50,000) — locks the listing."
- Rent copy: "Booking deposit — secures your booking."
- Success copy: sale → "Reserved, agent will contact you"; rent → "Booked".
- Remove owner-amount / platform-cut rows.

---

## 6. Phasing

**Phase A — core demo (must)**

1. `.env` out of git (security) — `git rm --cached backend/.env`, add to `.gitignore`, rotate keys
2. Sale → 1%-capped reservation fee, listing `reserved`
3. Rent → flat booking deposit, listing `booked`
4. Remove Connect/Transfer; single platform charge
5. Refund/cancel endpoint
6. `payments` ledger table + wiring
7. Frontend modal copy + breakdown update

**Phase B — trust extras (strong demo)** 8. Verification fee → paid `is_verified_seller` 9. Shared-housing application fee + room-hold

**Phase C — report / future-work (no build)** 10. Subscriptions, payout premium, monthly rent collection, finance referral, local-PSP (Paymob/Fawry) migration

---

## 7. Examiner narrative

"AXIOM monetizes commitment, trust, and workflow — not full property checkout. Sales charge a capped reservation fee that locks the listing and triggers offline document review and financing; rentals charge a booking deposit. Payments run through Stripe (sandbox) into a single platform account, keeping AXIOM a marketplace orchestrator, not an unlicensed wallet under Egypt's 2025 CBE PSP law. Production would migrate to Egyptian rails (Paymob/Fawry) because Stripe Connect transfers aren't supported for EGP — which is why owner payout is modeled as future work, not built."
