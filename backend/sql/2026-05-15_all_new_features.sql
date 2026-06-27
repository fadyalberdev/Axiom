alter table public.listing_applications
  add column if not exists lifestyle_data jsonb default '{}'::jsonb,
  add column if not exists compatibility_reasons jsonb default '[]'::jsonb;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  renter_id uuid not null references public.profiles(id),
  owner_id uuid not null references public.profiles(id),
  booking_type varchar(10) not null check (booking_type in ('rent', 'sale')),
  start_date date,
  end_date date,
  duration_months int,
  monthly_price numeric,
  total_price numeric not null,
  platform_cut_pct numeric not null default 5.0,
  platform_cut_amount numeric not null,
  owner_amount numeric not null,
  status varchar not null default 'pending_confirmation'
    check (status in ('pending_confirmation', 'active', 'completed', 'cancelled')),
  renter_confirmed_at timestamptz,
  tenant_vacated_at timestamptz,
  vacated_by varchar(20) check (vacated_by in ('renter', 'owner', 'auto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_disbursements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  month_number int not null,
  amount numeric not null,
  scheduled_date date not null,
  status varchar not null default 'scheduled' check (status in ('scheduled', 'released')),
  owner_requested_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, month_number)
);

create index if not exists idx_bookings_renter on public.bookings(renter_id, created_at desc);
create index if not exists idx_bookings_owner on public.bookings(owner_id, created_at desc);
create index if not exists idx_bookings_listing on public.bookings(listing_id);
create index if not exists idx_bookings_status_end_date on public.bookings(status, end_date);
create index if not exists idx_disbursements_booking on public.booking_disbursements(booking_id, month_number);

create unique index if not exists uniq_active_sale_booking
  on public.bookings(listing_id)
  where booking_type = 'sale' and status in ('pending_confirmation', 'active');
