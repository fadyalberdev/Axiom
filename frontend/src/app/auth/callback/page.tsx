"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import dynamic from "next/dynamic";
import type { AuthUser } from "@/types";
import type { Session } from "@supabase/supabase-js";

const ProfileCompletionModal = dynamic(
  () => import("@/components/auth/ProfileCompletionModal"),
  { ssr: false }
);

function isOAuthSession(session: Session): boolean {
  const identities = session.user?.identities ?? [];
  return identities.some((i) => i.provider !== "email");
}

function isProfileIncomplete(user: AuthUser | null): boolean {
  if (!user) return false;
  return !user.phone || !user.gender || !user.birth_date;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let done = false;

    const redirect = async (session: Session | null) => {
      if (done) return;
      done = true;
      if (!session) {
        router.replace("/login?error=oauth_failed");
        return;
      }

      // Sync session into the store before refreshing profile
      useAuthStore.setState({ session });
      await useAuthStore.getState().refreshProfile();

      // Fall back to session metadata if backend profile fetch failed
      const currentUser = useAuthStore.getState().user ?? {
        id: session.user.id,
        email: session.user.email ?? "",
        role: "user" as const,
        full_name: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null,
        phone: null,
        whatsapp_number: null,
        country_code: null,
        gender: null,
        avatar_url: session.user.user_metadata?.avatar_url ?? session.user.user_metadata?.picture ?? null,
        bio: null,
        badges: [],
        is_verified_seller: false,
        birth_date: null,
      };

      // Show modal for any OAuth user who hasn't filled in phone/gender/birth_date
      if (isOAuthSession(session) && isProfileIncomplete(currentUser)) {
        document.cookie = "axiom-onboarding-pending=1; path=/; SameSite=Lax; max-age=86400";
        setUser(currentUser);
        setShowCompletionModal(true);
        return;
      }

      // Clear any stale onboarding cookie before entering the app
      document.cookie = "axiom-onboarding-pending=; path=/; max-age=0; SameSite=Lax";
      router.replace("/dashboard");
    };

    // If Supabase already parsed the session from the URL hash / PKCE code
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirect(session);
    });

    // Otherwise wait for the SIGNED_IN event (PKCE exchange completes async)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        redirect(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleModalClose = () => {
    document.cookie = "axiom-onboarding-pending=; path=/; max-age=0; SameSite=Lax";
    setShowCompletionModal(false);
    router.replace("/dashboard");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background-dark">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Completing sign in…</p>
      </div>

      {user && (
        <ProfileCompletionModal
          user={user}
          open={showCompletionModal}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
