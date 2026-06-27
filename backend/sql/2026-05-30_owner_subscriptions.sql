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
alter table public.listings add column if not exists paused_at timestamptz;

-- Record subscription charges in the existing payments ledger.
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('reservation', 'booking_deposit', 'verification', 'application_fee', 'subscription'));
