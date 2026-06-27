-- Remove the enum used only by retired shared-housing applications.

drop type if exists public.application_status;
