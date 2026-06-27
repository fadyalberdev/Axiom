# Production Stabilization & Feature-Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every listed regression and UI issue across Admin, Auth, Listings, Pricing, Blogs, Footer, Dashboard, and Agencies/Universities without redesigning architecture or refactoring unrelated code.

**Architecture:** Next.js 16 App Router frontend + FastAPI backend. All fixes are frontend-only unless noted. Each task is independently verifiable with TypeScript compilation + visual inspection.

**Tech Stack:** Next.js 16, TypeScript (strict), Tailwind CSS, shadcn/ui, TanStack Query v5, Zustand, Supabase Auth, Framer Motion.

## Global Constraints

- Run `npx tsc --noEmit` inside `frontend/` after every task — zero errors required
- Never use `broker_id`, `"broker"` role, or `"seeker"` role
- All `"use client"` components that use `React.ElementType` must import it explicitly
- Use `<Image>` from `next/image`, never raw `<img>`
- Support email: `support@axiom.eg` (use this wherever support email is needed)

---

### Task 1: Admin — Remove Fraud Queue

**Files:**
- Modify: `frontend/src/components/admin/AdminSidebar.tsx`
- Modify: `frontend/src/app/admin/dashboard/page.tsx`

**Why:** Fraud Queue duplicates Pending Approvals data. Remove it entirely from sidebar, dashboard overview stat cards, quick actions, and the FraudView component.

- [ ] **Step 1: Remove Fraud Queue from AdminSidebar**

In `frontend/src/components/admin/AdminSidebar.tsx`, remove the entire "Moderation" group (lines 66-69):

```tsx
// DELETE this entire group from NAV_GROUPS:
{
  label: "Moderation",
  items: [{ id: "fraud", label: "Fraud Queue", icon: AlertTriangle, alert: true }],
},
```

Also remove unused imports: `AlertTriangle` from lucide-react (if not used elsewhere).

- [ ] **Step 2: Remove FraudView component from admin dashboard page**

In `frontend/src/app/admin/dashboard/page.tsx`:

a) Remove `reviewFraud` from the import at the top:
```tsx
// BEFORE:
import {
  approveListing,
  createItem,
  deleteItem,
  getAdminSignedUploadUrl,
  getStats,
  isLoggedIn,
  listItems,
  rejectListing,
  reviewFraud,
  updateItem,
} from "@/lib/admin/api";

// AFTER:
import {
  approveListing,
  createItem,
  deleteItem,
  getAdminSignedUploadUrl,
  getStats,
  isLoggedIn,
  listItems,
  rejectListing,
  updateItem,
} from "@/lib/admin/api";
```

b) Delete the entire `FraudView` component (lines ~2383–2551, from `// ── Fraud Queue View ──` to closing `}`).

c) In `DashboardOverview`, remove the "Flagged Fraud" stat card from `statCards` array:
```tsx
// DELETE this entry from statCards:
{ label: "Flagged Fraud", key: "flagged_listings", icon: AlertTriangle, color: "red", section: "fraud" },
```

d) In `DashboardOverview`, remove "Fraud Queue" from `quickActions`:
```tsx
// BEFORE:
const quickActions = [
  { label: "Manage Users", section: "users", icon: Users, color: "blue" },
  { label: "Review Listings", section: "pending-approvals", icon: Home, color: "green" },
  { label: "Fraud Queue", section: "fraud", icon: AlertTriangle, color: "red" },
] as const;

// AFTER:
const quickActions = [
  { label: "Manage Users", section: "users", icon: Users, color: "blue" },
  { label: "Review Listings", section: "pending-approvals", icon: Home, color: "green" },
] as const;
```

e) In the main page component render switch (where `activeSection` routes to components), remove the `fraud` case. Find the section that maps `activeSection === "fraud"` to `<FraudView />` and delete it.

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

---

### Task 2: Admin — Remove Role Filter from Users Section

**Files:**
- Modify: `frontend/src/app/admin/dashboard/page.tsx`

**Why:** Admin Users section should not expose a Role filter dropdown.

- [ ] **Step 1: Remove extraFilters from users SECTIONS config**

In `frontend/src/app/admin/dashboard/page.tsx`, find the `users` entry in `SECTIONS` (around line 146) and delete the `extraFilters` property:

```tsx
// BEFORE:
users: {
  title: "Users",
  apiSection: "users",
  searchPlaceholder: "Search by name...",
  extraFilters: [{ key: "role", label: "Role", type: "select", options: ["user", "admin"] }],
  columns: [

// AFTER:
users: {
  title: "Users",
  apiSection: "users",
  searchPlaceholder: "Search by name...",
  columns: [
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 3: Admin — Show Owner Name + Owner ID on Listings

**Files:**
- Modify: `frontend/src/app/admin/dashboard/page.tsx`

**Why:** Admin needs to see both owner name and owner ID together on listing rows.

- [ ] **Step 1: Update the owner column in listings SECTIONS config**

Find the `owner_id` column in the `listings` section `columns` array (around line 190) and update its render:

```tsx
// BEFORE:
{
  key: "owner_id",
  label: "Owner",
  render: (_v, row) => {
    const owner = row.profiles as Record<string, unknown> | null | undefined;
    const label = owner?.full_name || owner?.email;
    return label ? (
      <span className="font-semibold text-zinc-800">{String(label)}</span>
    ) : (
      <Badge color="red">No owner</Badge>
    );
  },
},

// AFTER:
{
  key: "owner_id",
  label: "Owner",
  render: (v, row) => {
    const owner = row.profiles as Record<string, unknown> | null | undefined;
    const name = owner?.full_name || owner?.email;
    return name ? (
      <div className="min-w-0">
        <p className="font-semibold text-zinc-800 truncate">{String(name)}</p>
        <p className="text-xs text-zinc-400 font-mono truncate">{String(v ?? "")}</p>
      </div>
    ) : (
      <Badge color="red">No owner</Badge>
    );
  },
},
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 4: Admin — Hide Chatbot from Admin Panel

**Files:**
- Modify: `frontend/src/components/layout/ChatbotConditional.tsx`

**Why:** Root layout wraps admin routes, so ChatbotConditional renders chatbot in admin. Add `/admin` to hidden paths.

- [ ] **Step 1: Add /admin to HIDDEN_PATHS**

```tsx
// BEFORE:
const HIDDEN_PATHS = ["/login", "/signup", "/forgot-password", "/auth/"];

// AFTER:
const HIDDEN_PATHS = ["/login", "/signup", "/forgot-password", "/auth/", "/admin"];
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 5: Admin — Fix Listings Status Filter (Add Draft, Clean Status Badge)

**Files:**
- Modify: `frontend/src/app/admin/dashboard/page.tsx`

**Why:** The status filter and status badge in the admin listings table don't handle `draft` status explicitly.

- [ ] **Step 1: Add `draft` to listings status filter options**

Find `extraFilters` for listings (around line 183):

```tsx
// BEFORE:
{ key: "status", label: "Status", type: "select", options: ["active", "pending", "rejected", "sold", "rented"] },

// AFTER:
{ key: "status", label: "Status", type: "select", options: ["active", "pending", "draft", "rejected", "sold", "rented"] },
```

- [ ] **Step 2: Update the status badge render to handle draft**

Find the `status` column render in listings columns (around line 214):

```tsx
// BEFORE:
{
  key: "status", label: "Status",
  render: (v) => <Badge color={v === "active" ? "green" : v === "pending" ? "yellow" : v === "sold" ? "blue" : "gray"}>{String(v ?? "")}</Badge>,
},

// AFTER:
{
  key: "status", label: "Status",
  render: (v) => {
    const color =
      v === "active" ? "green" :
      v === "pending" ? "yellow" :
      v === "sold" ? "blue" :
      v === "draft" ? "gray" :
      v === "rejected" ? "red" :
      "purple";
    return <Badge color={color}>{String(v ?? "")}</Badge>;
  },
},
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 6: Auth — Fix Middleware (Logged-in Users Can Visit /forgot-password)

**Files:**
- Modify: `frontend/middleware.ts`

**Why:** Logged-in users legitimately need `/forgot-password` from dashboard settings. Currently it's in `authRoutes` which redirects them away. This causes confusion. `/login` and `/signup` should still redirect logged-in users.

- [ ] **Step 1: Remove /forgot-password from authRoutes**

```ts
// BEFORE:
const authRoutes = ["/login", "/signup", "/forgot-password"];

// AFTER:
const authRoutes = ["/login", "/signup"];
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 7: Auth — Login: Remove Phone Tab + Facebook OAuth

**Files:**
- Modify: `frontend/src/components/auth/LoginForm.tsx`

**Why:** Login should use only email/password. Phone OTP and Facebook OAuth must be removed.

- [ ] **Step 1: Replace LoginForm with email-only version**

Replace the entire file content of `frontend/src/components/auth/LoginForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import OAuthButton from "@/components/auth/OAuthButton";
import { GoogleIcon } from "@/components/auth/OAuthIcons";

export default function LoginForm() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string).trim();
    const password = fd.get("password") as string;

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      await login(email, password);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed.";
      setError(msg);
      toast.error(msg);
    }
  };

  const inputClass =
    "auth-field block w-full rounded-lg border border-white/10 bg-[#101010] px-4 py-3 text-white caret-primary placeholder:text-white/30 transition-[border-color,box-shadow,background-color] duration-150 ease-out focus:border-primary/70 focus:bg-[#121212] focus:outline-none focus:ring-2 focus:ring-primary/30 sm:text-sm";
  const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50";
  const iconButtonClass =
    "absolute inset-y-0 right-0 flex items-center px-3 text-white/40 transition-[color,transform] duration-150 ease-out hover:text-white active:scale-95";

  return (
    <motion.div
      initial={{ opacity: 0, transform: "translateY(14px)" }}
      animate={{ opacity: 1, transform: "translateY(0)" }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      className="w-full justify-self-center lg:justify-self-end"
    >
      <div className="mx-auto w-full max-w-xl rounded-lg border border-white/10 bg-[#171717]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:p-7">
        <div className="mb-7 flex items-start justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              AXIOM
            </p>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Sign in to open your dashboard, listings, and saved homes.
            </p>
          </div>
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-200 sm:flex">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="Password"
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={iconButtonClass}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="custom-checkbox h-4 w-4"
              />
              <label
                htmlFor="remember-me"
                className="ml-2 block cursor-pointer text-sm text-white/50 transition-colors duration-150 hover:text-white"
              >
                Remember Me
              </label>
            </div>
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-primary transition-colors duration-150 hover:text-primary-hover"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(255,90,60,0.22)] transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Signing in..." : "Log In"}
              {!isLoading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#171717] px-3 text-white/40">Or continue with</span>
          </div>
        </div>

        <OAuthButton provider="google" label="Google" icon={<GoogleIcon />} />

        <div className="mt-6 text-center">
          <p className="text-sm text-white/50">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-primary transition-colors duration-150 hover:text-primary-hover"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 8: Auth — Signup: Remove Facebook + Add Egyptian Phone Validation

**Files:**
- Modify: `frontend/src/components/auth/SignUpForm.tsx`

**Why:** Remove Facebook OAuth. Enforce Egyptian phone format `/^01[0125][0-9]{8}$/` on the local number field (after stripping country code for +20 numbers).

- [ ] **Step 1: Remove Facebook OAuthButton**

Find the OAuth grid section (around line 357):

```tsx
// BEFORE:
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
  <OAuthButton provider="google" label="Google" icon={<GoogleIcon />} />
  <OAuthButton provider="facebook" label="Facebook" icon={<FacebookIcon />} />
</div>

// AFTER:
<div className="grid grid-cols-1 gap-3">
  <OAuthButton provider="google" label="Google" icon={<GoogleIcon />} />
</div>
```

- [ ] **Step 2: Remove FacebookIcon import**

```tsx
// BEFORE:
import { GoogleIcon, FacebookIcon } from "@/components/auth/OAuthIcons";

// AFTER:
import { GoogleIcon } from "@/components/auth/OAuthIcons";
```

- [ ] **Step 3: Add Egyptian phone validation in handleSubmit**

In the `handleSubmit` function, after the existing phone required check, add Egyptian format validation for +20 numbers:

```tsx
// After the existing:
// if (!submittedPhone) { setError("Phone number is required."); return; }

// Add:
if (countryCode === "+20") {
  const egyptianPhone = submittedPhone.replace(/\D/g, "");
  if (!/^01[0125][0-9]{8}$/.test(egyptianPhone)) {
    setError("Phone number must be a valid Egyptian number (e.g. 01012345678).");
    return;
  }
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 9: Auth — Forgot Password: Remove Phone Tab, Email Only

**Files:**
- Modify: `frontend/src/components/auth/ForgotPasswordForm.tsx`

**Why:** Unify forgot password to email-only flow. Remove phone/OTP recovery path.

- [ ] **Step 1: Replace ForgotPasswordForm with email-only version**

Replace the entire file content of `frontend/src/components/auth/ForgotPasswordForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const panelClass =
  "rounded-[1.25rem] border border-white/10 bg-[#151515] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-10";
const labelClass =
  "mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/42";
const inputClass =
  "auth-field block w-full rounded-lg border border-white/10 bg-[#101010] px-4 py-3 text-sm text-white placeholder:text-white/28 outline-none transition-[border-color,background-color,box-shadow] duration-150 focus:border-primary/70 focus:bg-[#121212] focus:shadow-[0_0_0_3px_rgba(255,90,60,0.12)]";

export default function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string).trim();

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
      setSent(true);
      toast.success("Reset link sent. Check your email.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send reset link.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <div className={panelClass}>
        <div className="mb-7 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Account recovery
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
            Reset your password
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/50">
            Enter your account email address and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="py-3 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-300" />
            </div>
            <h2 className="text-xl font-black text-white">Check your email</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">
              If an AXIOM account exists for that email, a reset link will arrive shortly.
            </p>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className={labelClass}>
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@example.com"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-black text-white shadow-[0_16px_36px_rgba(255,90,60,0.18)] transition-[background-color,transform,opacity] duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <div className="mt-8 border-t border-white/10 pt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 transition-colors hover:text-primary-hover hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 10: Blog — Fix External Image Domains (next.config.ts)

**Files:**
- Modify: `frontend/next.config.ts`

**Why:** Admin creates blog posts with hero images from arbitrary external URLs. Next.js Image throws `Invalid src prop` for unconfigured hostnames. Fix: add a permissive wildcard HTTPS pattern scoped only to the images config (does not change CSP or allow arbitrary script/frame sources).

- [ ] **Step 1: Add wildcard HTTPS hostname to remotePatterns**

In `frontend/next.config.ts`, add this entry to `remotePatterns`:

```ts
// Add after the last existing entry:
{
  protocol: "https",
  hostname: "**",
},
```

**Note:** This allows any HTTPS image URL in Next.js optimization. CSP headers (already set in the config) still restrict where images load from in the browser via `img-src 'self' data: blob: https:`. The `unoptimized` alternative would require touching every blog image component and is more invasive.

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 11: Blog — Remove Newsletter/Subscribe Sections

**Files:**
- Modify: `frontend/src/app/blog/[slug]/page.tsx`
- Modify: `frontend/src/components/blog/BlogSidebar.tsx`

**Why:** Blog listing page and individual blog post pages still have subscribe/newsletter sections. Remove UI, forms, and buttons. Keep all other blog layout and functionality.

- [ ] **Step 1: Remove NewsletterCTA from blog article page**

In `frontend/src/app/blog/[slug]/page.tsx`:

Remove the import:
```tsx
// DELETE:
import NewsletterCTA from "@/components/blog-article/NewsletterCTA";
```

Remove the component usage (find `<NewsletterCTA />` in the JSX and delete that line).

- [ ] **Step 2: Remove subscribe form from BlogSidebar**

In `frontend/src/components/blog/BlogSidebar.tsx`, find and delete the entire subscribe block (the `<div>` containing "Cairo market notes" heading and the email form with Subscribe button):

```tsx
// DELETE this entire block (~lines 109-132):
<div className="bg-card-dark p-7 rounded-2xl border border-white/10 relative overflow-hidden">
  <h3 className="text-white font-bold text-xl mb-2 relative z-10">
    Cairo market notes
  </h3>
  <p className="text-gray-400 text-sm mb-6 relative z-10 leading-relaxed">
    Weekly reads on rent movement, shared homes, and areas worth watching.
  </p>
  <form
    className="space-y-3 relative z-10"
    onSubmit={(e) => e.preventDefault()}
  >
    <input
      type="email"
      placeholder="Enter your email"
      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
    />
    <button
      type="submit"
      className="w-full bg-primary hover:bg-primary-hover active:scale-[0.98] text-white font-semibold py-3 rounded-lg transition-[background-color,transform] duration-200 ease-out shadow-lg shadow-primary/20"
    >
      Subscribe
    </button>
  </form>
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 12: Dashboard Stats — Remove 0% Badges

**Files:**
- Modify: `frontend/src/components/dashboard/DashboardStats.tsx`

**Why:** Stats show trend badges like "0%" which are meaningless. Hide the badge entirely when trendPercent is "0%" or "0".

- [ ] **Step 1: Conditionally render trendPercent badge**

In `frontend/src/components/dashboard/DashboardStats.tsx`, wrap the trend badge in a check:

```tsx
// BEFORE (around line 84):
<span
  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${
    stat.trendUp
      ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300"
      : "border-red-400/15 bg-red-400/10 text-red-300"
  }`}
>
  {stat.trendUp ? (
    <TrendingUp className="h-3 w-3" />
  ) : (
    <TrendingDown className="h-3 w-3" />
  )}
  {stat.trendPercent}
</span>

// AFTER:
{stat.trendPercent && stat.trendPercent !== "0%" && stat.trendPercent !== "0" && (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${
      stat.trendUp
        ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300"
        : "border-red-400/15 bg-red-400/10 text-red-300"
    }`}
  >
    {stat.trendUp ? (
      <TrendingUp className="h-3 w-3" />
    ) : (
      <TrendingDown className="h-3 w-3" />
    )}
    {stat.trendPercent}
  </span>
)}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 13: Dashboard Stats — Use Real Package Limits for Active Listings Target

**Files:**
- Modify: `frontend/src/components/dashboard/DashboardStats.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`

**Why:** "Active Listings" health bar uses hardcoded `/ 10` as target. Should use user's actual plan listing cap (Trial=3, Basic=5, Pro=20).

- [ ] **Step 1: Add optional `listingCap` prop to DashboardStats**

In `frontend/src/components/dashboard/DashboardStats.tsx`:

```tsx
// BEFORE:
interface DashboardStatsProps {
  stats: AnalyticsStat[];
}

// AFTER:
interface DashboardStatsProps {
  stats: AnalyticsStat[];
  listingCap?: number;
}
```

Update the `getHealth` function signature and the "active" case:

```tsx
// BEFORE:
function getHealth(stat: AnalyticsStat) {
  const value = getNumericValue(stat.value);
  const label = stat.label.toLowerCase();
  ...
  if (label.includes("active")) {
    return {
      label: "Portfolio depth",
      percent: Math.max(0, Math.min(100, (value / 10) * 100)),
      detail: `${value} of 10 target`,
    };
  }

// AFTER:
function getHealth(stat: AnalyticsStat, listingCap?: number) {
  const value = getNumericValue(stat.value);
  const label = stat.label.toLowerCase();
  ...
  if (label.includes("active")) {
    const cap = listingCap ?? 10;
    return {
      label: "Portfolio depth",
      percent: Math.max(0, Math.min(100, (value / cap) * 100)),
      detail: `${value} of ${cap} target`,
    };
  }
```

Update the call inside the map:
```tsx
// BEFORE:
const health = getHealth(stat);

// AFTER:
const health = getHealth(stat, listingCap);
```

Update component signature:
```tsx
// BEFORE:
export default function DashboardStats({ stats }: DashboardStatsProps) {

// AFTER:
export default function DashboardStats({ stats, listingCap }: DashboardStatsProps) {
```

- [ ] **Step 2: Pass listingCap from dashboard page**

In `frontend/src/app/dashboard/page.tsx`, find where subscription data is queried and pass `listing_cap` to DashboardStats:

```tsx
// Find the subscription query (already imported as subscriptionQuery).
// Add the subscription query if not already present (it is imported at line 14):
const { data: subData } = useQuery(subscriptionQuery);

// Then find where DashboardStats is rendered and add the prop:
// BEFORE:
<DashboardStats stats={stats} />

// AFTER:
<DashboardStats stats={stats} listingCap={subData?.listing_cap} />
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 14: Footer — Replace Newsletter with Contact Support + Fix Legal Links

**Files:**
- Modify: `frontend/src/components/layout/Footer.tsx`
- Modify: `frontend/src/lib/constants.ts`

**Why:** Newsletter section has no backend. Replace with contact support. Legal links are `<span>` elements with no href — replace with proper `<Link>` elements.

- [ ] **Step 1: Replace Newsletter section in Footer**

In `frontend/src/components/layout/Footer.tsx`, find the "Newsletter" `<div>` block and replace:

```tsx
// BEFORE:
{/* Newsletter */}
<div>
  <h3 className="text-white font-bold mb-6 text-sm">Newsletter</h3>
  <p className="text-gray-500 text-xs mb-4">
    Subscribe to get the latest market trends and vibe checks.
  </p>
  <div className="flex">
    <input
      type="email"
      placeholder="Your email"
      className="bg-white/5 border border-white/10 text-white text-xs rounded-l-lg py-2.5 px-4 focus:outline-none focus:border-primary w-full"
    />
    <button className="bg-primary hover:bg-primary-hover text-white px-3 rounded-r-lg transition-colors">
      <Send className="h-3.5 w-3.5" />
    </button>
  </div>
</div>

// AFTER:
{/* Contact Support */}
<div>
  <h3 className="text-white font-bold mb-6 text-sm">Support</h3>
  <p className="text-gray-500 text-xs mb-4 leading-relaxed">
    Have a question or need help? Our support team is here for you.
  </p>
  <a
    href="mailto:support@axiom.eg"
    className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors"
  >
    <Send className="h-3 w-3" />
    Contact Support
  </a>
</div>
```

- [ ] **Step 2: Fix Legal Links to use proper hrefs in Footer**

In `frontend/src/components/layout/Footer.tsx`, find the Legal section and replace `<span>` with `<Link>`:

```tsx
// BEFORE:
{LEGAL_LINKS.map((link) => (
  <li key={link.href}>
    <span>
      {link.label}
    </span>
  </li>
))}

// AFTER:
{LEGAL_LINKS.map((link) => (
  <li key={link.href}>
    <Link
      href={link.href}
      className="hover:text-primary transition-colors"
    >
      {link.label}
    </Link>
  </li>
))}
```

- [ ] **Step 3: Ensure LEGAL_LINKS in constants.ts has correct hrefs**

In `frontend/src/lib/constants.ts`, find `LEGAL_LINKS` and ensure it has:

```ts
export const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
];
```

- [ ] **Step 4: Also remove unused `Send` import if it was only for newsletter**

Keep `Send` import since it's now used in the Contact Support button.

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 15: Legal Pages — Create Privacy, Terms, and Cookie Policy Pages

**Files:**
- Create: `frontend/src/app/privacy/page.tsx`
- Create: `frontend/src/app/terms/page.tsx`
- Create: `frontend/src/app/cookies/page.tsx`

**Why:** Footer links reference `/privacy`, `/terms`, `/cookies` but these pages don't exist (confirmed by prior observation 1461).

- [ ] **Step 1: Create Privacy Policy page**

Create `frontend/src/app/privacy/page.tsx`:

```tsx
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background-dark py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary mb-4">Legal</p>
        <h1 className="text-3xl font-black tracking-tight text-white mb-2">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: June 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-white font-bold text-lg mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly: name, email, phone number, gender, and property preferences. We also collect usage data when you interact with AXIOM.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">2. How We Use Your Information</h2>
            <p>Your data is used to operate and improve the platform, match listings to your preferences, process payments, and communicate service updates. We do not sell your personal information.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">3. Data Storage</h2>
            <p>Data is stored securely on Supabase infrastructure. We apply industry-standard encryption in transit and at rest.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">4. Your Rights</h2>
            <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us at <a href="mailto:support@axiom.eg" className="text-primary hover:underline">support@axiom.eg</a>.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">5. Contact</h2>
            <p>For privacy questions, contact <a href="mailto:support@axiom.eg" className="text-primary hover:underline">support@axiom.eg</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create Terms & Conditions page**

Create `frontend/src/app/terms/page.tsx`:

```tsx
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background-dark py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary mb-4">Legal</p>
        <h1 className="text-3xl font-black tracking-tight text-white mb-2">Terms &amp; Conditions</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: June 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-white font-bold text-lg mb-3">1. Acceptance of Terms</h2>
            <p>By using AXIOM, you agree to these Terms &amp; Conditions. If you do not agree, do not use the platform.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">2. User Responsibilities</h2>
            <p>You are responsible for the accuracy of your listings and profile information. Fraudulent or misleading listings will result in account suspension.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">3. Subscription Plans</h2>
            <p>Subscription fees are billed monthly. Cancellations take effect at the end of the current billing period. Refunds are not provided for partial periods.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">4. Prohibited Conduct</h2>
            <p>You may not use AXIOM to post illegal content, harass other users, or circumvent platform security measures.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">5. Contact</h2>
            <p>For questions, contact <a href="mailto:support@axiom.eg" className="text-primary hover:underline">support@axiom.eg</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create Cookie Policy page**

Create `frontend/src/app/cookies/page.tsx`:

```tsx
export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-background-dark py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary mb-4">Legal</p>
        <h1 className="text-3xl font-black tracking-tight text-white mb-2">Cookie Policy</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: June 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-white font-bold text-lg mb-3">1. What Are Cookies</h2>
            <p>Cookies are small text files stored on your device when you visit AXIOM. They help us keep you signed in and remember your preferences.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">2. Cookies We Use</h2>
            <p><strong className="text-white">Authentication cookies:</strong> Required to keep you signed in (Supabase session tokens).</p>
            <p className="mt-2"><strong className="text-white">Preference cookies:</strong> Remember your search filters and UI settings.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">3. Managing Cookies</h2>
            <p>You can disable cookies in your browser settings. Note that disabling authentication cookies will prevent you from staying signed in.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">4. Contact</h2>
            <p>For cookie questions, contact <a href="mailto:support@axiom.eg" className="text-primary hover:underline">support@axiom.eg</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 16: Listings — Remove Website Fee from AddListingModal

**Files:**
- Modify: `frontend/src/components/dashboard/AddListingModal.tsx`

**Why:** The platform fee preview (5% fee calculator) should be removed from the listing creation flow.

- [ ] **Step 1: Remove calculatePlatformFee import**

```tsx
// BEFORE:
import { calculatePlatformFee, formatEGP } from "@/lib/utils";

// AFTER:
import { formatEGP } from "@/lib/utils";
```

(Keep `formatEGP` if used elsewhere in the file; check and remove if not.)

- [ ] **Step 2: Remove feePreview computation (around line 598)**

```tsx
// DELETE:
const feePreview = priceNumber > 0 ? calculatePlatformFee(priceNumber) : null;
```

- [ ] **Step 3: Remove fee preview UI block (lines ~823-844)**

Delete the entire conditional fee display block:

```tsx
// DELETE:
{feePreview && (
  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
    <div className="flex items-center justify-between gap-3 text-gray-400">
      <span>{recurringPrice ? "Your price" : "Listing price"}</span>
      <span className="font-semibold text-white">
        {formatEGP(priceNumber)}{recurringPrice ? " / month" : ""}
      </span>
    </div>
    <div className="mt-1 flex items-center justify-between gap-3 text-gray-400">
      <span>Platform fee (5%)</span>
      <span className="font-semibold text-gray-200">
        - {formatEGP(feePreview.platformFee)}{recurringPrice ? " / month" : ""}
      </span>
    </div>
    <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-2 text-gray-300">
      <span>You receive</span>
      <span className="font-bold text-primary">
        {formatEGP(feePreview.ownerReceives)}{recurringPrice ? " / month" : ""}
      </span>
    </div>
  </div>
)}
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 17: Listings — Fix AddListingModal Sizing

**Files:**
- Modify: `frontend/src/components/dashboard/AddListingModal.tsx`

**Why:** Modal is too narrow (`max-w-3xl`) and the form body has `max-h-[70vh]` which creates awkward double-scroll. The Continue button should always be visible.

- [ ] **Step 1: Fix modal container sizing**

Find the modal container div (around line 612):

```tsx
// BEFORE:
<div className="relative transform overflow-hidden rounded-3xl bg-card-dark text-left shadow-2xl sm:my-8 w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto border border-white/10">

// AFTER:
<div className="relative transform rounded-3xl bg-card-dark text-left shadow-2xl sm:my-8 w-[95vw] max-w-4xl border border-white/10 flex flex-col" style={{ maxHeight: "min(90vh, 860px)" }}>
```

- [ ] **Step 2: Fix form body scroll**

Find the form body div (around line 626):

```tsx
// BEFORE:
<div className="px-4 py-6 sm:px-8 space-y-8 max-h-[70vh] overflow-y-auto">

// AFTER:
<div className="px-4 py-6 sm:px-8 space-y-8 overflow-y-auto flex-1 min-h-0">
```

- [ ] **Step 3: Make footer sticky**

The footer buttons area (around line 1690-1762) — ensure it has a sticky bottom style. Find the footer container and add:

```tsx
// The footer div containing Cancel/Back/Continue/Submit buttons:
// BEFORE (find this wrapping div):
<div className="border-t border-white/5 px-4 py-4 sm:px-8 flex items-center justify-end gap-3 flex-wrap">

// AFTER:
<div className="border-t border-white/5 px-4 py-4 sm:px-8 flex items-center justify-end gap-3 flex-wrap flex-shrink-0 bg-card-dark">
```

If the footer is not already in its own container outside the scrollable area, restructure so that:
1. Modal outer div = flex column
2. Header = flex-shrink-0
3. Form body = flex-1 overflow-y-auto
4. Footer buttons = flex-shrink-0

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 18: Listings — View Tracking on Property Page

**Files:**
- Create: `frontend/src/components/property/ViewTracker.tsx`
- Modify: `frontend/src/app/property/[id]/page.tsx`

**Why:** Property page is a server component. Views are never incremented on page visit. A small client component mounted on load calls the view-increment endpoint.

- [ ] **Step 1: Create ViewTracker client component**

Create `frontend/src/components/property/ViewTracker.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

export default function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    api.post(`/api/listings/${listingId}/view`).catch(() => {});
  }, [listingId]);

  return null;
}
```

- [ ] **Step 2: Add ViewTracker to property page**

In `frontend/src/app/property/[id]/page.tsx`, import and render ViewTracker:

```tsx
import ViewTracker from "@/components/property/ViewTracker";
```

In the returned JSX, add `<ViewTracker listingId={data.id} />` as the first child (it renders null so position doesn't matter).

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 19: Listings — Draft Badge in MyListings

**Files:**
- Modify: `frontend/src/components/dashboard/MyListings.tsx`

**Why:** MyListings.tsx already has `draft` in `STATUS_STYLES` and `STATUS_LABEL`. Verify draft status renders the badge and confirm `mapListing` in dashboard/page.tsx maps `draft` → `"draft"` (it already does at line 33). This task is a verification task + add an explicit "Draft" indicator in the listing card if not already prominent.

- [ ] **Step 1: Verify draft badge renders correctly**

Check in `MyListings.tsx` that the status badge uses `STATUS_STYLES[listing.status]` and `STATUS_LABEL[listing.status]`. The existing code already has:

```tsx
const STATUS_STYLES = { ..., draft: "bg-gray-500/10 text-gray-400 border-gray-500/10" };
const STATUS_LABEL = { ..., draft: "Draft" };
```

If the badge uses `STATUS_LABEL[listing.status]` and `STATUS_STYLES[listing.status]`, it already works. Read the render code and confirm. If the badge is not rendered for draft, add it.

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 20: Pricing — Fix Trial → Basic Upgrade Button

**Files:**
- Modify: `frontend/src/app/pricing/page.tsx`

**Why:** When `currentPlan === "trial"`, the Basic plan card shows "Trial active" badge but no upgrade button. The condition `!isTrial` blocks the upgrade button for trial users on Basic. Trial users must always be able to upgrade to Basic or Pro.

- [ ] **Step 1: Fix PlanCard to show upgrade button for trial users**

In `frontend/src/app/pricing/page.tsx`, update `PlanCard`:

```tsx
// BEFORE (line 291):
{plan.key !== "free" && !isCurrent && !isTrial && !isLowerTier && (
  <button onClick={() => onUpgrade(plan.key as "basic" | "pro")} ...>

// AFTER:
{plan.key !== "free" && !isCurrent && !isLowerTier && (
  <button onClick={() => onUpgrade(plan.key as "basic" | "pro")} ...>
```

This makes trial users see upgrade buttons for both Basic and Pro plans. The "Trial active" badge can remain alongside the upgrade button by moving the badge to a different position. Update the `(isCurrent || isTrial)` badge block:

```tsx
// BEFORE (line 324):
{(isCurrent || isTrial) && plan.key !== "free" && (
  <div ...>
    <Check className="h-4 w-4" />
    {isTrial ? "Trial active" : "Active plan"}
  </div>
)}

// AFTER: show "Trial active" label above the upgrade button for trial+basic, not instead of it.
// Remove isTrial from this badge (it will now show the upgrade button instead):
{isCurrent && plan.key !== "free" && (
  <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/12 px-4 py-3 text-sm font-semibold text-primary">
    <Check className="h-4 w-4" />
    Active plan
  </div>
)}
```

And add a trial label above the upgrade button area for trial+basic:
```tsx
// In the upgrade button section, before the button for trial+basic:
{isTrial && (
  <p className="mb-2 text-xs text-center text-white/40">
    Converting from trial to paid
  </p>
)}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

---

### Task 21: Pricing — Contact Us Opens Support Email

**Files:**
- No change needed

**Why:** The `AgencyPanel` component in pricing page already implements `<a href="mailto:hello@axiom.eg?subject=Agency%20Plan%20Enquiry">Contact us</a>`. This is correct. Update the email to match the global support email if needed.

- [ ] **Step 1: Verify/update support email in AgencyPanel**

In `frontend/src/app/pricing/page.tsx`, find AgencyPanel (~line 491):

```tsx
// BEFORE:
href="mailto:hello@axiom.eg?subject=Agency%20Plan%20Enquiry"

// AFTER (if support email is different):
href="mailto:support@axiom.eg?subject=Pricing%20Enquiry"
```

---

### Task 22: Admin — Add Listing Status `draft` to Edit Fields

**Files:**
- Modify: `frontend/src/app/admin/dashboard/page.tsx`

**Why:** The admin listing `editFields` and `createFields` status select don't include `draft`. Add it so admins can set a listing to draft.

- [ ] **Step 1: Add "draft" to status options in SECTIONS listings config**

Find editFields status field (around line 239):
```tsx
// BEFORE:
{ key: "status", label: "Status", type: "select", options: ["active", "pending", "rejected", "sold", "rented"] },

// AFTER:
{ key: "status", label: "Status", type: "select", options: ["active", "pending", "draft", "rejected", "sold", "rented"] },
```

Do the same for createFields (around line 280).

Also in `AdminListingEditForm` status select (line 1317):
```tsx
// BEFORE:
{["active", "pending", "rejected", "sold", "rented"].map((status) => ...)}

// AFTER:
{["active", "pending", "draft", "rejected", "sold", "rented"].map((status) => ...)}
```

---

### Task 23: AI System — Investigate and Restore

**Files:**
- Investigate: git history around 2026-06-16 to 2026-06-17
- Fix: Based on findings

**Why:** AI Description generation and chatbot knowledge access stopped working. Must restore from known-good state around Jun 16-17.

- [ ] **Step 1: Compare git history**

```bash
cd E:/GradProject/AXIOM-V2
git log --oneline --since="2026-06-14" --until="2026-06-20" -- backend/
```

- [ ] **Step 2: Check what changed in AI endpoints**

```bash
git diff $(git log --oneline --since="2026-06-14" --until="2026-06-18" -- backend/app/routers/ai.py | tail -1 | cut -d' ' -f1)..HEAD -- backend/app/routers/ai.py
```

- [ ] **Step 3: Check RAG pipeline**

```bash
git log --oneline --since="2026-06-14" --until="2026-06-20" -- backend/app/services/ backend/app/rag/
git diff HEAD~10 HEAD -- backend/app/services/ backend/app/rag/
```

- [ ] **Step 4: Check embeddings and vector DB**

```bash
git log --oneline --since="2026-06-14" --until="2026-06-20" -- backend/app/rag/ backend/app/embeddings.py 2>/dev/null || true
```

- [ ] **Step 5: Restore regressions**

Based on diff analysis, revert only the lines that broke the AI system. Document specific root causes in this plan before applying fix.

---

### Task 24: Agencies — Founded Date + Development History + Remove Property Switches

**Files:**
- Modify: `frontend/src/app/agencies/[slug]/page.tsx`
- Modify: `frontend/src/components/agency-details/AgencyHero.tsx` (or whichever component shows "0 Years Development History")
- Modify: `frontend/src/components/agency-details/AgencySidebar.tsx`

**Why:** Agency pages show "0 Years Development History" hardcoded, and have property type switches (All Projects, Luxury Condos, Penthouses) that need to be removed. Founded Date and Support Email need to be added from database fields.

- [ ] **Step 1: Read current agency detail components**

```bash
cat E:/GradProject/AXIOM-V2/frontend/src/components/agency-details/AgencyHero.tsx
cat E:/GradProject/AXIOM-V2/frontend/src/components/agency-details/AgencySidebar.tsx
```

- [ ] **Step 2: Replace "0 Years Development History" with calculated value**

Find the hardcoded "0 Years Development History" text and replace with:

```tsx
const yearsActive = agency.founded_year
  ? new Date().getFullYear() - agency.founded_year
  : null;

// In JSX:
{yearsActive !== null ? `${yearsActive} Years Development History` : "Established Agency"}
```

- [ ] **Step 3: Add Support Email to agency display**

Add support email field (from `agency.email`) to the sidebar or hero contact section.

- [ ] **Step 4: Remove property type switches**

Find and delete UI elements labeled "All Projects", "Luxury Condos", "Penthouses" switches/tabs.

---

### Task 25: Trusted Partners — Use Real Agency Names, Marquee Animation

**Files:**
- Identify and modify the Trusted Partners / partners marquee component

**Why:** Trusted Partners section uses hardcoded names. Should pull real agency names from the database.

- [ ] **Step 1: Find the partners component**

```bash
grep -r "Trusted\|trusted\|marquee\|Marquee\|Partners\|partners" E:/GradProject/AXIOM-V2/frontend/src --include="*.tsx" -l
```

- [ ] **Step 2: Wire to real agency data**

Replace hardcoded partner names with a query to fetch agency names from the backend. Use existing agency query infrastructure.

- [ ] **Step 3: Add continuous marquee animation**

```tsx
// Add CSS animation for right-to-left marquee:
// In the component, add:
<div className="overflow-hidden">
  <div
    className="flex gap-8 animate-[marquee_20s_linear_infinite]"
    style={{ width: "max-content" }}
  >
    {[...agencies, ...agencies].map((agency, i) => (
      <span key={i} className="text-white/60 font-semibold whitespace-nowrap">
        {agency.name}
      </span>
    ))}
  </div>
</div>
```

Add to `tailwind.config.ts`:
```ts
extend: {
  keyframes: {
    marquee: {
      "0%": { transform: "translateX(0)" },
      "100%": { transform: "translateX(-50%)" },
    },
  },
  animation: {
    marquee: "marquee 20s linear infinite",
  },
},
```

---

### Task 26: Universities — Admin Contact Management + Real Data on Cards

**Files:**
- Modify: `frontend/src/app/admin/dashboard/page.tsx` (already has phone/email/website in edit fields — verify)
- Modify: `frontend/src/components/agencies/UniversityCard.tsx`
- Modify: `frontend/src/app/universities/page.tsx`

**Why:** University cards show hardcoded/placeholder data instead of real database values.

- [ ] **Step 1: Read UniversityCard**

```bash
cat E:/GradProject/AXIOM-V2/frontend/src/components/agencies/UniversityCard.tsx
```

- [ ] **Step 2: Verify admin has phone/email fields**

The admin `universities` section in SECTIONS config already has `phone`, `email`, `website` in `editFields` (confirmed at lines 407-416). No change needed in admin.

- [ ] **Step 3: Wire UniversityCard to real data**

Replace any hardcoded values in `UniversityCard.tsx` with actual `university.phone`, `university.email`, `university.city`, `university.student_count`, `university.accreditation` from the data being passed as props.

---

### Task 27: Blog — Fix Listing Page Subscribe Section Removal Verification

**Files:**
- Read `frontend/src/app/blog/page.tsx` — no subscribe section visible in current content (confirmed).
- Read `frontend/src/components/blog/BlogHero.tsx` — check for subscribe form.

Already handled in Task 11 (BlogSidebar and article page). Verify BlogHero has no subscribe form.

---

## Execution Order

Execute tasks in this order to minimize regressions:

1. Tasks 1-5 (Admin fixes — isolated changes)
2. Tasks 6-9 (Auth fixes)
3. Tasks 10-11 (Blog image + newsletter)
4. Tasks 12-13 (Dashboard stats)
5. Task 14-15 (Footer + legal)
6. Tasks 16-19 (Listings)
7. Tasks 20-22 (Pricing + admin status)
8. Task 23 (AI — investigate first, then fix)
9. Tasks 24-27 (Agencies/Universities — read components first)

## Verification After All Tasks

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm run build
```

Both must succeed with 0 errors.
