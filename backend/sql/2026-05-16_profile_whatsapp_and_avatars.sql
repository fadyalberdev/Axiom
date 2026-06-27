-- Add Egyptian-market contact support to user profiles.
-- Run in Supabase SQL editor before relying on whatsapp_number in production.

alter table public.profiles
  add column if not exists whatsapp_number text,
  add column if not exists birth_date date;

comment on column public.profiles.whatsapp_number is
  'Primary WhatsApp contact number shown/synced from user dashboard and admin profile editor.';

comment on column public.profiles.birth_date is
  'Date of birth used to calculate display age; age should not be edited directly in profile UI.';

-- Ask PostgREST/Supabase API to reload its schema cache so new columns are visible immediately.
notify pgrst, 'reload schema';

-- Avatar uploads use the existing avatars Supabase Storage bucket.
-- Ensure the bucket exists and is public if avatar_url stores public URLs.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = excluded.public;

-- Authenticated users can upload and replace files inside their own folder.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload their own avatars'
  ) then
    create policy "Users can upload their own avatars"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update their own avatars'
  ) then
    create policy "Users can update their own avatars"
    on storage.objects
    for update
    to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can read their own avatars for upsert'
  ) then
    create policy "Users can read their own avatars for upsert"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
