alter table public.profiles
  add column if not exists stripe_account_id text;

alter table public.bookings
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_transfer_id text;

create unique index if not exists uniq_bookings_stripe_payment_intent
  on public.bookings(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
