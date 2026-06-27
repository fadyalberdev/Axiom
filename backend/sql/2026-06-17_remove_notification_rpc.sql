-- Remove the last database API surface for the retired notifications feature.

drop function if exists public.get_unread_notification_count(uuid);
