import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables.\n" +
    "Copy frontend/.env.local.example to frontend/.env.local and fill in your values,\n" +
    "then restart the dev server."
  );
}

// Singleton via globalThis — prevents Turbopack HMR from spawning multiple
// clients that deadlock each other on the navigator.locks auth token.
declare global {
  // eslint-disable-next-line no-var
  var _supabase: SupabaseClient | undefined;
}

function makeClient() {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase: SupabaseClient =
  globalThis._supabase ?? (globalThis._supabase = makeClient());
