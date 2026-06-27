from supabase import create_client, Client
from app.config import settings

# Anon client — used for auth operations (sign_in_with_password, get_user)
supabase_client: Client = create_client(settings.supabase_url, settings.supabase_anon_key)

# Service role client — bypasses RLS, used for all server-side DB reads/writes
supabase_admin: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
