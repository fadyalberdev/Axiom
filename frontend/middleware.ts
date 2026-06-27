import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NOTE: The Supabase session is stored client-side in localStorage
  // (see frontend/src/lib/supabase.ts), so it is NOT available to this
  // server-side middleware as a cookie. Auth gating is therefore enforced
  // on the client: protected pages redirect via the auth store, and the
  // AuthRedirectGuard keeps signed-in users off /login and /signup.
  //
  // The only auth signal we can read here is the onboarding-pending cookie,
  // which IS set explicitly during the auth callback.
  const onboardingPending = !!request.cookies.get(
    "axiom-onboarding-pending"
  )?.value;

  // Block protected routes until onboarding is complete
  if (
    onboardingPending &&
    protectedRoutes.some((r) => pathname.startsWith(r))
  ) {
    return NextResponse.redirect(new URL("/auth/callback", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
