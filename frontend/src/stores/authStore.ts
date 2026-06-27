import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AuthUser, SignUpData } from "@/types";
import { queryClient } from "@/lib/queryClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchProfile(
  accessToken: string,
  retries = 0,
  delayMs = 600,
): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      // Retry on 401 — profile DB trigger may not have completed yet
      if (res.status === 401 && retries > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
        return fetchProfile(accessToken, retries - 1, delayMs);
      }
      return null;
    }
    return res.json();
  } catch {
    return null;
  }
}

async function fetchProfileFromSupabase(userId: string): Promise<AuthUser | null> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, phone, whatsapp_number, bio, role, is_verified_seller, gender, country_code, badges, birth_date, age, occupation, lifestyle_preferences, created_at, updated_at")
      .eq("id", userId)
      .single();
    if (!data) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    return {
      id: d.id,
      email: d.email ?? "",
      role: d.role ?? "user",
      full_name: d.full_name ?? null,
      phone: d.phone ?? null,
      whatsapp_number: d.whatsapp_number ?? null,
      country_code: d.country_code ?? null,
      gender: d.gender ?? null,
      avatar_url: d.avatar_url ?? null,
      bio: d.bio ?? null,
      badges: d.badges ?? [],
      is_verified_seller: d.is_verified_seller ?? false,
      birth_date: d.birth_date ?? null,
      age: d.age ?? null,
      occupation: d.occupation ?? null,
      lifestyle_preferences: d.lifestyle_preferences ?? null,
    };
  } catch {
    return null;
  }
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signup: (data: SignUpData) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// Track the auth listener unsubscribe function outside the store
// to prevent duplicate subscriptions (React StrictMode calls effects twice)
let authListenerUnsub: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    // Guard: skip if a listener is already registered (prevents duplicate listeners in React StrictMode)
    if (authListenerUnsub) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const user =
        await fetchProfile(session.access_token, 2, 600) ??
        await fetchProfileFromSupabase(session.user.id);
      if (!user) {
        // Profile missing — account was deleted. Sign out immediately.
        await supabase.auth.signOut();
        set({ session: null, user: null, isInitialized: true });
      } else {
        set({ session, user, isInitialized: true });
      }
    } else {
      set({ isInitialized: true });
    }

    // Keep state in sync with Supabase auth events (token refresh, OAuth, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          // Only skip token refreshes during active login — SIGNED_IN must always sync
          if (event === "TOKEN_REFRESHED" && get().isLoading) return;
          if (session) {
            const user =
              await fetchProfile(session.access_token, 2, 600) ??
              await fetchProfileFromSupabase(session.user.id);
            if (!user) {
              // Profile missing — account was deleted. Sign out immediately.
              await supabase.auth.signOut();
              set({ session: null, user: null });
            } else {
              set({ session, user });
            }
          }
        } else if (event === "SIGNED_OUT") {
          set({ session: null, user: null });
        }
      },
    );
    authListenerUnsub = () => subscription.unsubscribe();
  },

  loginWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error(error.message);
      // Retry up to 2 times — profile may lag behind auth
      const user =
        await fetchProfile(data.session.access_token, 2, 600) ??
        await fetchProfileFromSupabase(data.session.user.id);
      const resolvedUser: AuthUser = user ?? {
        id: data.session.user.id,
        email: data.session.user.email ?? email,
        role: "user",
        full_name: data.session.user.user_metadata?.full_name ?? null,
        phone: null,
        whatsapp_number: null,
        country_code: null,
        gender: null,
        avatar_url: data.session.user.user_metadata?.avatar_url ?? null,
        bio: null,
        badges: [],
        is_verified_seller: false,
        birth_date: null,
      };
      queryClient.clear();
      set({ session: data.session, user: resolvedUser });
    } finally {
      set({ isLoading: false });
    }
  },

  sendPhoneOtp: async (phone) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: false },
      });
      if (error) throw new Error(error.message);
    } finally {
      set({ isLoading: false });
    }
  },

  verifyPhoneOtp: async (phone, token) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
      if (error) throw new Error(error.message);
      if (!data.session) throw new Error("Phone verification did not create a session.");

      const user =
        await fetchProfile(data.session.access_token, 2, 600) ??
        await fetchProfileFromSupabase(data.session.user.id);
      const resolvedUser: AuthUser = user ?? {
        id: data.session.user.id,
        email: data.session.user.email ?? "",
        role: "user",
        full_name: data.session.user.user_metadata?.full_name ?? null,
        phone: data.session.user.phone ?? phone,
        whatsapp_number: null,
        country_code: null,
        gender: null,
        avatar_url: data.session.user.user_metadata?.avatar_url ?? null,
        bio: null,
        badges: [],
        is_verified_seller: false,
        birth_date: null,
      };
      queryClient.clear();
      set({ session: data.session, user: resolvedUser });
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async ({ email, password, full_name, phone, country_code, gender }) => {
    set({ isLoading: true });
    try {
      // Go through FastAPI so it can set phone/country on the profile
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name, phone, country_code, gender }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { detail?: string }).detail || "Signup failed");
      }
      // Email confirmation required — account created but not yet confirmed
      if (res.status === 202) {
        throw new Error((body as { message?: string }).message || "Check your email to confirm your account");
      }
      // Sign in via Supabase JS to get a managed session
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error(error.message);
      // Retry up to 3 times — the profile trigger may lag behind user creation
      const user = await fetchProfile(data.session.access_token, 3, 800);
      queryClient.clear();
      set({ session: data.session, user });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    set({ session: null, user: null });
  },

  refreshProfile: async () => {
    const { session } = get();
    if (!session) return;
    const user = await fetchProfile(session.access_token);
    if (user) set({ user });
  },
}));
