-- Payment & monetization model pivot (demo)
-- Spec: docs/superpowers/specs/2026-05-29-payment-monetization-model.md
-- Single platform Stripe account. Small fees only. No Connect, no owner payout.

-- 1. New listing statuses for commitment flows.
--    'reserved' = sale listing locked by a reservation fee (closes offline).
--    'booked'   = rent listing secured by a booking deposit.
alter type listing_status add value if not exists 'reserved';
alter type listing_status add value if not exists 'booked';

-- 2. Platform payments ledger — source of truth for every charge.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  listing_id uuid references public.listings(id),
  booking_id uuid references public.bookings(id) on delete set null,
  kind text not null
    check (kind in ('reservation', 'booking_deposit', 'verification', 'application_fee')),
  amount numeric(12, 2) not null,
  currency text not null default 'egp',
  stripe_payment_intent_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'refunded', 'failed')),
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);

create index if not exists idx_payments_user on public.payments(user_id, created_at desc);
create index if not exists idx_payments_listing on public.payments(listing_id);
create index if not exists idx_payments_booking on public.payments(booking_id);

-- 3. bookings.total_price now stores the fee/deposit charged, not the full lease/sale price.
--    (No schema change required; semantics only. monthly_price/duration retained for display.)
