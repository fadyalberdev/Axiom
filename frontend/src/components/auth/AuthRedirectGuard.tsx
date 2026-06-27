"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

const AUTH_ONLY_PATHS = ["/login", "/signup"];

/**
 * Keeps already-authenticated users off the login and signup pages.
 *
 * The Supabase session lives in localStorage (browser-side), so the server
 * middleware can't see it. This guard runs client-side and redirects a
 * signed-in user away from the auth pages once auth state has initialized.
 */
export default function AuthRedirectGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isInitialized } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = AUTH_ONLY_PATHS.includes(pathname);
  const shouldRedirect = isInitialized && !!user && isAuthPage;

  useEffect(() => {
    if (!shouldRedirect) return;
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    router.replace(redirect && redirect.startsWith("/") ? redirect : "/");
  }, [shouldRedirect, router]);

  // Avoid flashing the auth form before the redirect lands.
  if (shouldRedirect) return null;

  return <>{children}</>;
}
