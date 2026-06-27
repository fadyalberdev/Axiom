# AXIOM Owner Subscriptions — Design Spec

**Date:** 2026-05-30
**Status:** Approved design (no code yet)
**Scope:** Graduation demo. Stripe sandbox retained, single platform account, no Connect.
**Covers:** Revenue **Layer 1 — owner subscriptions** only. Other layers are separate specs.

---

## 1. Why this exists

The earlier model (`2026-05-29-payment-monetization-model.md`) charged the **buyer** a
reservation fee to "reserve" a sale listing. That is unnatural for the Egyptian market —
buyers do not pay a website to hold a property; sales happen offline through agents and
phone/WhatsApp. A buyer-paid online reservation reads as suspicious, not premium.

**Decision:** stop charging buyers on the sale side. Move the core revenue to the
**owner/seller side** as a subscription — which buyers everywhere already understand
(SaaS listing plans). Buyers transact online only for **rent / shared-housing deposits**,
where a holding fee is culturally accepted.

This spec defines the owner subscription system. It **supersedes the sale reservation fee**
in the 2026-05-29 spec (that removal is executed in the separate rent/shared-deposit spec).

### Full revenue model (context — only Layer 1 is built here)

| # | Layer | Who pays | Mechanism | Spec |
| - | ----- | -------- | --------- | ---- |
| 1 | **Owner subscriptions** | owner/seller | tiered monthly plans gating listing quantity + AI | **this spec** |
| 2 | Rent + shared-housing deposit | seeker | booking deposit = % of total lease value | future spec |
| 3 | Sale | nobody (buyer free) | lead-gen / connect to owner-agent | future spec |
| 4 | Agency projects | agency | pay-to-list + monthly metered charge on generated leads | future spec |

---

## 2. Core rules (locked)

1. **Everyone can post 1 active listing for free, forever.** No subscription, no trial needed.
2. **A subscription is required only to hold _more than 1_ active listing.**
3. **7-day Trial** — one-time, gives elevated access (3 listings + the full AI quota) so a
   new owner can try the paid experience. After it ends, the account reverts to Free (cap 1)
   unless they subscribe.
4. **Fraud detection + listing validation always run** for every listing on every plan,
   including Free. They are a trust/safety layer, never a paid feature — users must trust
   they are "not paying for dreams."
5. **All buyer/seeker-facing AI is free and ungated:** RAG chatbot, NLP search,
   recommendations, roommate compatibility. Buyers are anyone browsing/buying; they never
   subscribe.
6. **Only owner-consumed productivity AI is metered** (today: the AI listing-description
   generator). Metered by a monthly quota per plan.
7. **Agencies are sales-led, not self-serve.** No public agency plan; agencies "contact us"
   and are provisioned manually by an admin (their project-listing + metered-lead billing is
   a separate layer/spec).

---

## 3. Plans

| Plan | Price (EGP/mo) | Active-listing cap | Metered AI (descriptions/mo) | Notes |
| ---- | -------------- | ------------------ | ---------------------------- | ----- |
| **Free** | 0 | 1 | 0 | default for every account |
| **Trial** | 0 | 3 | 50 | one-time, 7 days |
| **Basic** | 199 | 5 | 10 | |
| **Pro** | 499 | 20 | 50 | featured-listing slots |
| **Agency** | contact us | custom | custom | admin-provisioned, not self-serve |

Prices and caps are config constants (tunable). Currency EGP, billed monthly.

---

## 4. Lifecycle

### Subscribe / upgrade
- Owner picks Basic or Pro → Stripe Subscription created on the single platform account
  (recurring EGP). On `active`/`trialing`, the account's plan + caps update.
- Upgrade/downgrade changes caps immediately on the next webhook sync.

### Trial
- Triggered once per account (track `trial_used`). Sets plan = Trial for 7 days (3 listings, full AI quota).
- On expiry (no paid plan) → revert to Free. Enter the **lapse** flow below.

### Lapse / downgrade (cap shrinks)
When the effective active-listing cap drops below the owner's current active-listing count
(trial ended, subscription cancelled, payment failed → `past_due`/`canceled`):

1. **Pause excess listings immediately.** Keep the newest `cap` listings active; the rest
   become `paused` (hidden from search/detail, data retained). Owner chooses which to keep
   active if they act; otherwise oldest-first are paused.
2. **7-day grace.** Paused listings display an owner-only banner: "Subscribe to restore —
   deleted in N days."
3. **Delete after grace.** Paused listings still not covered by an active plan after 7 days
   are **soft-deleted** (`deleted_at` set), consistent with existing listing deletion.

The 1 Free-floor listing is never paused or deleted for lack of subscription.

---

## 5. Enforcement points

| Action | Check | On fail |
| ------ | ----- | ------- |
| Create listing | active-listing count < plan cap | 402/409 + "upgrade to add more listings" |
| Reactivate a paused listing | would not exceed cap | block + upgrade prompt |
| AI description generate | monthly AI count < plan quota | 402 + "AI limit reached for this plan" |
| Fraud / validation AI | — | always runs, never blocked |
| Buyer-facing AI | — | always free, never checked |

"Active listing" = listing with `status` in the live set (e.g. `active`, `pending`,
`reserved`, `booked`) and `deleted_at IS NULL`. Excludes `paused`, `rejected`, soft-deleted.

---

## 6. Data model (new migration)

```sql
-- Plan enum
create type subscription_plan as enum ('free', 'trial', 'basic', 'pro', 'agency');

-- One row per owner; created lazily as 'free' on first need.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id),
  plan subscription_plan not null default 'free',
  status text not null default 'active',   -- active|trialing|past_due|canceled
  stripe_customer_id text,
  stripe_subscription_id text unique,
  trial_used boolean not null default false,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  ai_descriptions_used int not null default 0,  -- reset monthly
  ai_period_start timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- New listing status for the lapse flow.
alter type listing_status add value if not exists 'paused';

-- Track when a paused listing entered grace (for the 7-day delete sweep).
alter table public.listings add column if not exists paused_at timestamptz;
```

Subscription payments are also recorded in the existing `payments` ledger
(`kind = 'subscription'` — add to the kind check) for a single source of truth.

RLS: `subscriptions` written by backend service role; owners may read their own row.

---

## 7. Backend

New module `backend/app/subscriptions/`:

- `GET /api/subscriptions/me` — current plan, caps, usage (listing count, AI used/quota), trial state.
- `POST /api/subscriptions/checkout` — create Stripe Subscription Checkout / SetupIntent for Basic|Pro; returns client secret / checkout URL.
- `POST /api/subscriptions/start-trial` — start the one-time 7-day trial (guard `trial_used`).
- `POST /api/subscriptions/cancel` — cancel at period end.
- Webhook (extend existing `stripe_webhooks`): handle
  `customer.subscription.created|updated|deleted`, `invoice.paid`,
  `invoice.payment_failed` → sync `plan`/`status`/`current_period_end`, record in `payments`,
  trigger lapse flow when caps shrink.

Shared helper `get_effective_plan(user_id) -> {plan, listing_cap, ai_quota, ai_used}` used by:
- listing-create endpoint (quota gate),
- AI description endpoint (AI quota gate + increment).

**Lapse sweep:** a scheduled task (reuse the existing lease-expiry scheduler pattern) that:
- pauses excess listings when a plan lapses, and
- soft-deletes listings `paused_at < now() - 7 days` still uncovered.

Config (`config.py`): plan price IDs (Stripe), caps, AI quotas, trial length (7d), grace (7d).

---

## 8. Frontend

- **Pricing/plans page** (`/pricing` or dashboard "Plan" tab): Free/Basic/Pro cards, current
  plan highlighted, "Start 7-day trial" CTA (if `!trial_used`), upgrade/cancel.
- **Listing create / AddListingModal:** when at cap, replace submit with an upgrade prompt;
  show "1 of N listings used."
- **AI description button:** show remaining quota; disable + upgrade hint when exhausted.
- **Dashboard listings:** `paused` listings get a banner with the grace countdown + restore CTA.
- **Checkout:** Stripe Subscription via Checkout redirect or embedded Payment Element.

---

## 9. What we DON'T build here (YAGNI / other specs)

- Rent + shared-housing deposit (Layer 2) — separate spec; also removes the sale reservation
  fee + flat rent deposit from the 2026-05-29 model.
- Sale lead-gen / connect flow (Layer 3).
- Agency pay-to-list + metered lead billing (Layer 4) — sales-led, manual provisioning.
- Proration edge cases, annual billing, coupons, dunning emails — out of demo scope.

---

## 10. Examiner narrative

"AXIOM's primary revenue is an owner subscription, not a charge on buyers. Anyone lists one
property free; listing more requires a monthly plan that also raises an AI-description quota.
A 7-day trial unlocks the paid experience once. Trust-critical AI — fraud detection and
listing validation — always runs on every plan, so buyers can trust listings regardless of
what the owner pays. Buyer-facing discovery AI is free to keep the marketplace liquid. This
keeps AXIOM a marketplace orchestrator under Egypt's 2025 CBE PSP law: recurring fees land in
a single platform Stripe account, with no Connect and no holding of third-party funds."
