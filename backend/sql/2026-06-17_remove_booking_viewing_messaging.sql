-- Remove retired booking, viewing, and in-app messaging surfaces.
-- The product now uses applications and WhatsApp lead capture instead.

drop table if exists public.booking_disbursements cascade;
drop table if exists public.bookings cascade;
drop table if exists public.viewings cascade;
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
drop table if exists public.blocked_users cascade;

drop function if exists public.update_conversation_last_message() cascade;
drop function if exists public.get_user_conversations(uuid) cascade;
drop type if exists public.viewing_status cascade;

delete from public.notifications
where type in ('new_message', 'viewing_confirmed');

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'listing_approved',
      'listing_rejected',
      'application_received',
      'application_approved',
      'application_rejected'
    )
  );

update public.leads
set source = 'whatsapp_click'
where source = 'schedule_viewing';

alter table public.leads
  drop constraint if exists leads_source_check;

alter table public.leads
  add constraint leads_source_check
  check (source = 'whatsapp_click');

delete from public.payments
where kind in ('reservation', 'booking_deposit');

drop index if exists public.idx_payments_booking;

alter table public.payments
  drop column if exists booking_id;

alter table public.payments
  drop constraint if exists payments_kind_check;

alter table public.payments
  add constraint payments_kind_check
  check (kind in ('verification', 'application_fee', 'subscription'));
