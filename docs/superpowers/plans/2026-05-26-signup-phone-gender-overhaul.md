# Signup / Phone / Gender Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the SignUpForm with WhatsApp, gender (male/female only), ToS, password strength, eye toggle, proper E.164 phone normalization — and unify phone number handling across all frontend + backend touch-points.

**Architecture:** Add a `phoneUtils.ts` utility for E.164 normalization (strips leading `0` before prepending country code). Update `GenderType` to `"male" | "female"` everywhere. Rewrite `SignUpForm`. Separate `phone` / `whatsapp_number` in `ProfileSettings`. One Supabase migration updates the DB CHECK constraint.

**Tech Stack:** Next.js 16, TypeScript strict, Tailwind CSS, FastAPI/Python, Supabase SQL migration

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `frontend/src/lib/phoneUtils.ts` | **Create** | E.164 builder utility |
| `frontend/src/types/index.ts` | Modify | `GenderType` → `"male" \| "female"`, add `whatsapp_number` to `SignUpData` |
| `frontend/src/lib/queries.ts` | Modify | gender literal type → `"male" \| "female"` |
| `frontend/src/components/auth/SignUpForm.tsx` | Modify | Full rewrite of form |
| `frontend/src/components/dashboard/ProfileSettings.tsx` | Modify | Separate phone + whatsapp fields |
| `frontend/src/app/admin/dashboard/page.tsx` | Modify | Remove `"other"` from gender options array |
| `backend/app/auth/schemas.py` | Modify | Add `whatsapp_number` to `SignUpRequest`; update gender comment |
| `backend/app/auth/router.py` | Modify | Pass `whatsapp_number` through signup |
| `docs/schema/006_gender_constraint.sql` | **Create** | Migration: update gender CHECK to `('male', 'female')` |

---

## Task 1: Phone normalization utility

**Files:**
- Create: `frontend/src/lib/phoneUtils.ts`

- [ ] **Step 1: Create the utility**

```ts
// frontend/src/lib/phoneUtils.ts

/**
 * Build E.164 from a country code and subscriber input.
 * Strips leading zeros from subscriber input (Egyptian numbers are typed as
 * "01001234567" but E.164 requires "+201001234567", not "+2001001234567").
 */
export function buildE164(countryCode: string, subscriberInput: string): string {
  const digits = subscriberInput.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return `${countryCode}${digits}`;
}

/**
 * Validate E.164 format: + then 7–14 digits.
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,13}$/.test(phone);
}

/**
 * Returns placeholder hint for a country code.
 */
export function phonePlaceholder(countryCode: string): string {
  if (countryCode === "+20") return "01X XXXX XXXX";
  if (countryCode === "+1")  return "(555) 123-4567";
  if (countryCode === "+44") return "07XXX XXXXXX";
  if (countryCode === "+971") return "05X XXX XXXX";
  return "Phone number";
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/phoneUtils.ts
git commit -m "feat(phone): add E.164 normalizer utility with leading-zero strip"
```

---

## Task 2: Update TypeScript types

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/queries.ts`

- [ ] **Step 1: Update `GenderType` and `SignUpData` in `types/index.ts`**

In `frontend/src/types/index.ts`, change line 15:
```ts
// before
export type GenderType = "male" | "female" | "other";

// after
export type GenderType = "male" | "female";
```

In the same file, add `whatsapp_number` to `SignUpData` (currently lines 54–61):
```ts
export interface SignUpData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  whatsapp_number?: string;
  country_code?: string;
  gender?: GenderType;
}
```

- [ ] **Step 2: Update gender literal in `queries.ts`**

In `frontend/src/lib/queries.ts` around line 204, find:
```ts
gender?: "male" | "female" | "other" | null;
```
Replace with:
```ts
gender?: "male" | "female" | null;
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors, or only errors in files we haven't fixed yet (SignUpForm, admin page).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/queries.ts
git commit -m "feat(types): GenderType male/female only; add whatsapp_number to SignUpData"
```

---

## Task 3: Fix admin dashboard gender options

**Files:**
- Modify: `frontend/src/app/admin/dashboard/page.tsx:168`

- [ ] **Step 1: Remove "other" from gender options**

Find this line (~line 168):
```ts
{ key: "gender", label: "Gender", type: "select", options: ["male", "female", "other"] },
```
Change to:
```ts
{ key: "gender", label: "Gender", type: "select", options: ["male", "female"] },
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/dashboard/page.tsx
git commit -m "fix(admin): remove 'other' gender option from user editor"
```

---

## Task 4: Backend — add whatsapp_number to signup schema + router

**Files:**
- Modify: `backend/app/auth/schemas.py`
- Modify: `backend/app/auth/router.py`

- [ ] **Step 1: Update `SignUpRequest` schema**

In `backend/app/auth/schemas.py`, replace the `SignUpRequest` class:
```python
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    country_code: Optional[str] = None
    gender: Optional[str] = None  # "male" | "female"
```

- [ ] **Step 2: Pass `whatsapp_number` through in `router.py`**

In `backend/app/auth/router.py`, inside the `signup` function, find the `update_data` block (~lines 84–96):

```python
    # before
    update_data: dict = {}
    if body.phone:
        update_data["phone"] = body.phone
    if body.country_code:
        update_data["country_code"] = body.country_code
    if body.gender:
        update_data["gender"] = body.gender

    # after
    update_data: dict = {}
    if body.phone:
        update_data["phone"] = body.phone
    if body.whatsapp_number:
        update_data["whatsapp_number"] = body.whatsapp_number
    elif body.phone:
        # default whatsapp to phone if not provided separately
        update_data["whatsapp_number"] = body.phone
    if body.country_code:
        update_data["country_code"] = body.country_code
    if body.gender:
        update_data["gender"] = body.gender
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/auth/schemas.py backend/app/auth/router.py
git commit -m "feat(auth): accept whatsapp_number in signup; default to phone if omitted"
```

---

## Task 5: Supabase DB migration — gender constraint

**Files:**
- Create: `docs/schema/006_gender_constraint.sql`

- [ ] **Step 1: Create migration SQL**

```sql
-- docs/schema/006_gender_constraint.sql
-- Remove 'other' from gender CHECK constraint on profiles table.
-- Run in Supabase SQL Editor.

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_gender_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_gender_check
    CHECK (gender IN ('male', 'female'));

-- Null out any existing 'other' values so the constraint doesn't block.
UPDATE profiles SET gender = NULL WHERE gender = 'other';
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Copy the SQL above into the Supabase dashboard → SQL Editor and execute.
Verify: `SELECT gender, count(*) FROM profiles GROUP BY gender;` — should show only `male`, `female`, or `NULL`.

- [ ] **Step 3: Commit the migration file**

```bash
git add docs/schema/006_gender_constraint.sql
git commit -m "feat(db): tighten gender CHECK to male/female only; null out 'other' rows"
```

---

## Task 6: Rewrite SignUpForm

**Files:**
- Modify: `frontend/src/components/auth/SignUpForm.tsx`

This is the main task. Replace the entire file content.

- [ ] **Step 1: Write the new SignUpForm**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Eye, EyeOff } from "lucide-react";
import OAuthButton from "@/components/auth/OAuthButton";
import { GoogleIcon, FacebookIcon } from "@/components/auth/OAuthIcons";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { buildE164, phonePlaceholder } from "@/lib/phoneUtils";
import type { GenderType } from "@/types";

const COUNTRY_CODES = ["+20", "+1", "+44", "+971"];

const GENDER_OPTIONS: { label: string; value: GenderType }[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
];

function getPasswordStrength(password: string): 0 | 1 | 2 | 3 {
  if (password.length < 6) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  return score as 0 | 1 | 2 | 3;
}

const STRENGTH_LABEL = ["", "Weak", "Fair", "Strong"] as const;
const STRENGTH_COLOR = ["", "bg-red-500", "bg-yellow-400", "bg-green-500"] as const;

export default function SignUpForm() {
  const router = useRouter();
  const { signup, isLoading } = useAuthStore();

  const [countryCode, setCountryCode] = useState("+20");
  const [phoneInput, setPhoneInput] = useState("");
  const [whatsappInput, setWhatsappInput] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [gender, setGender] = useState<GenderType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");

  const e164Phone = buildE164(countryCode, phoneInput);
  const e164WhatsApp = sameAsPhone
    ? e164Phone
    : buildE164(countryCode, whatsappInput);

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const fd = new FormData(e.currentTarget);
    const full_name = (fd.get("name") as string).trim();
    const email = (fd.get("email") as string).trim();
    const confirmPassword = fd.get("confirm-password") as string;
    const tosAccepted = fd.get("tos") === "on";

    if (!full_name || !email || !password) {
      setError("Name, email, and password are required.");
      return;
    }
    if (!gender) {
      setError("Please select your gender.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!phoneInput.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!tosAccepted) {
      setError("You must accept the Terms of Service.");
      return;
    }

    try {
      await signup({
        email,
        password,
        full_name,
        phone: e164Phone || undefined,
        whatsapp_number: e164WhatsApp || undefined,
        country_code: countryCode,
        gender,
      });
      toast.success("Account created! Welcome to AXIOM.");
      router.push("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signup failed.";
      if (msg.toLowerCase().includes("confirm") || msg.toLowerCase().includes("check your email")) {
        setInfo(msg);
        toast.success("Account created! Check your email to confirm.");
      } else {
        setError(msg);
        toast.error(msg);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-lg"
    >
      <div className="bg-card-dark rounded-2xl shadow-2xl shadow-black/50 border border-white/10 p-8 sm:p-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-primary mb-2 tracking-tight">
            AXIOM
          </h2>
          <h1 className="text-2xl font-bold text-white">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Join the AI-powered real estate platform.
          </p>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {info && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
            {info}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Ahmed Mohamed"
              className="block w-full px-4 py-3 rounded-lg border border-white/10 bg-background-dark text-white placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="signup-email" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@example.com"
              className="block w-full px-4 py-3 rounded-lg border border-white/10 bg-background-dark text-white placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              Phone Number <span className="text-red-400">*</span>
            </label>
            <div className="flex rounded-lg shadow-sm">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="rounded-l-lg border border-r-0 border-white/10 bg-background-dark text-white focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm px-3 py-3 w-24"
              >
                {COUNTRY_CODES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder={phonePlaceholder(countryCode)}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="flex-1 min-w-0 block w-full px-4 py-3 rounded-r-lg border border-white/10 bg-background-dark text-white placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              WhatsApp Number
            </label>
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsPhone}
                onChange={(e) => setSameAsPhone(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 text-primary focus:ring-primary bg-transparent"
              />
              <span className="text-sm text-gray-300">Same as phone number</span>
            </label>
            {!sameAsPhone && (
              <div className="flex rounded-lg shadow-sm">
                <div className="rounded-l-lg border border-r-0 border-white/10 bg-background-dark text-gray-500 text-sm px-3 py-3 w-24 flex items-center">
                  {countryCode}
                </div>
                <input
                  type="tel"
                  placeholder={phonePlaceholder(countryCode)}
                  value={whatsappInput}
                  onChange={(e) => setWhatsappInput(e.target.value)}
                  className="flex-1 min-w-0 block w-full px-4 py-3 rounded-r-lg border border-white/10 bg-background-dark text-white placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm"
                />
              </div>
            )}
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Gender <span className="text-red-400">*</span>
            </label>
            <div className="flex space-x-4">
              {GENDER_OPTIONS.map((g) => (
                <label key={g.value} className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value={g.value}
                    checked={gender === g.value}
                    onChange={() => setGender(g.value)}
                    className="h-4 w-4 text-primary border-gray-600 focus:ring-primary bg-transparent"
                  />
                  <span className="ml-2 text-sm text-white">{g.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="signup-password" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-4 py-3 pr-12 rounded-lg border border-white/10 bg-background-dark text-white placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`flex-1 rounded-full transition-all ${
                          passwordStrength >= level ? STRENGTH_COLOR[passwordStrength] : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs mt-1 text-gray-400">{STRENGTH_LABEL[passwordStrength]}</p>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  className="block w-full px-4 py-3 pr-12 rounded-lg border border-white/10 bg-background-dark text-white placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Terms of Service */}
          <div className="pt-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="tos"
                required
                className="mt-0.5 h-4 w-4 rounded border-gray-600 text-primary focus:ring-primary bg-transparent"
              />
              <span className="text-sm text-gray-400">
                I agree to the{" "}
                <Link href="/terms" className="text-primary hover:text-primary-hover transition-colors">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-primary hover:text-primary-hover transition-colors">
                  Privacy Policy
                </Link>
              </span>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all shadow-lg shadow-primary/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Creating account…" : "Sign Up"}
            </button>
          </div>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-2 bg-card-dark text-gray-400">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <OAuthButton provider="google" label="Google" icon={<GoogleIcon />} />
          <OAuthButton provider="facebook" label="Facebook" icon={<FacebookIcon />} />
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:text-primary-hover transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 3: Also update `authStore.ts` — signup call already accepts `whatsapp_number` via `SignUpData` type update in Task 2. Verify the store's `signup` function passes it:**

In `frontend/src/stores/authStore.ts` line 209–217, the destructure already passes through what `SignUpData` declares, so if the type now includes `whatsapp_number`, the fetch body will include it. Verify:

```ts
signup: async ({ email, password, full_name, phone, country_code, gender }) => {
```

Must become:
```ts
signup: async ({ email, password, full_name, phone, whatsapp_number, country_code, gender }) => {
```

And the `body: JSON.stringify(...)` line must include `whatsapp_number`:
```ts
body: JSON.stringify({ email, password, full_name, phone, whatsapp_number, country_code, gender }),
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/auth/SignUpForm.tsx frontend/src/stores/authStore.ts
git commit -m "feat(signup): WhatsApp field, male/female only, ToS, strength meter, eye-toggle confirm"
```

---

## Task 7: Fix ProfileSettings — separate phone + WhatsApp

**Files:**
- Modify: `frontend/src/components/dashboard/ProfileSettings.tsx`

- [ ] **Step 1: Update `ProfileFormState` and `buildForm`**

Replace the `ProfileFormState` type and `buildForm` function (lines 32–50):

```ts
type ProfileFormState = {
  full_name: string;
  phone: string;
  whatsapp_number: string;
  whatsapp_same_as_phone: boolean;
  country_code: string;
  birth_date: string;
  avatar_url: string;
  bio: string;
};

function buildForm(profile: ApiProfileResponse): ProfileFormState {
  const phone = profile.phone ?? "";
  const wa = profile.whatsapp_number ?? "";
  return {
    full_name: profile.full_name ?? "",
    phone,
    whatsapp_number: wa,
    whatsapp_same_as_phone: !wa || wa === phone,
    country_code: profile.country_code ?? "+20",
    birth_date: profile.birth_date?.slice(0, 10) ?? "",
    avatar_url: profile.avatar_url ?? "",
    bio: profile.bio ?? "",
  };
}
```

- [ ] **Step 2: Update `handleSubmit` payload**

Replace the payload construction inside `handleSubmit` (around line 169–178):

```ts
    const effectiveWhatsApp = form.whatsapp_same_as_phone
      ? emptyToNull(form.phone)
      : emptyToNull(form.whatsapp_number);

    const payload: UpdateProfileInput = {
      full_name: fullName,
      phone: emptyToNull(form.phone),
      whatsapp_number: effectiveWhatsApp,
      country_code: emptyToNull(form.country_code),
      birth_date: emptyToNull(form.birth_date),
      avatar_url: emptyToNull(form.avatar_url),
      bio: emptyToNull(form.bio),
    };
```

- [ ] **Step 3: Update the editing form JSX**

Replace the single "Phone / WhatsApp" label+Input block (around lines 327–335) with:

```tsx
<label className="grid gap-1.5 text-sm font-medium text-zinc-300">
  Phone
  <Input
    value={form.phone}
    onChange={(e) => setField("phone", e.target.value)}
    placeholder="+201001234567"
    className="h-10 rounded-xl border-white/10 bg-white/5 text-white"
  />
</label>
<div className="grid gap-1.5">
  <span className="text-sm font-medium text-zinc-300">WhatsApp</span>
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={form.whatsapp_same_as_phone}
      onChange={(e) => setField("whatsapp_same_as_phone", e.target.checked)}
      className="h-4 w-4 rounded border-gray-600 text-primary focus:ring-primary bg-transparent"
    />
    <span className="text-xs text-zinc-400">Same as phone</span>
  </label>
  {!form.whatsapp_same_as_phone && (
    <Input
      value={form.whatsapp_number}
      onChange={(e) => setField("whatsapp_number", e.target.value)}
      placeholder="+201001234567"
      className="h-10 rounded-xl border-white/10 bg-white/5 text-white"
    />
  )}
</div>
```

- [ ] **Step 4: Update the display view**

The display `contact` line (around line 184) currently combines phone and whatsapp. Replace:

```ts
  const contact = profile.phone || profile.whatsapp_number;
```

With the existing `infoRows` showing them separately (around line 186–198), change to:

```ts
  const infoRows: [string, string][] = [
    ["Phone", profile.phone || "Not set"],
    ["WhatsApp", profile.whatsapp_number || "Not set"],
    ["Gender", capitalize(profile.gender) ?? "Not set"],
    [
      "Birth date",
      profile.birth_date ? formatDate(`${profile.birth_date.slice(0, 10)}T00:00:00`) : "Not set",
    ],
    ["Age", displayAge ? `${displayAge} yrs` : "Not set"],
    [
      "Last updated",
      profile.updated_at ? formatDate(profile.updated_at) : "—",
    ],
  ];
```

And update the left quick-info panel (around lines 264–283) to show both:

```ts
            [
              ["Phone", profile.phone || "Not set"],
              ["WhatsApp", profile.whatsapp_number || profile.phone || "Not set"],
              ["Gender", capitalize(profile.gender) ?? "Not set"],
              ["Age", displayAge ? `${displayAge} yrs` : "Not set"],
              [
                "Since",
                profile.created_at ? formatDate(profile.created_at) : "—",
              ],
            ] as [string, string][]
```

- [ ] **Step 5: Remove the now-unused `contact` variable**

Delete line `const contact = profile.phone || profile.whatsapp_number;` (~line 184) since it's replaced above.

- [ ] **Step 6: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/dashboard/ProfileSettings.tsx
git commit -m "fix(profile): separate phone and WhatsApp fields; same-as-phone toggle"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Start dev server and manually test signup flow**

```bash
cd frontend && npm run dev
```

Verify:
1. `/signup` — phone placeholder shows `01X XXXX XXXX` for +20
2. Type `01001234567` → E.164 stored as `+201001234567` (not `+2001001234567`)
3. Gender radio only shows Male / Female
4. WhatsApp "same as phone" checkbox works; unchecking shows separate input
5. Password strength bar appears while typing
6. Confirm password has eye toggle
7. ToS checkbox required — submitting without it shows error
8. Submitting without gender shows "Please select your gender" error

- [ ] **Step 3: Run backend tests**

```bash
cd backend && python -m pytest tests/test_auth.py -v
```

Expected: all pass.

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -p
git commit -m "fix(signup): post-review cleanup"
```

---

## Self-Review Checklist

| Requirement | Covered by |
|-------------|-----------|
| Phone placeholder shows Egyptian format `01X XXXX XXXX` | Task 1 + Task 6 |
| Leading `0` stripped before building E.164 | Task 1 `buildE164` |
| WhatsApp field with "same as phone" | Task 6 (signup), Task 7 (profile) |
| Gender: male/female only | Task 2 (types), Task 3 (admin), Task 5 (DB), Task 6 (form) |
| Gender required + validated | Task 6 `handleSubmit` |
| Eye toggle on confirm password | Task 6 |
| ToS checkbox | Task 6 |
| `canSubmit` removed — all validation in `handleSubmit` | Task 6 |
| Password strength indicator | Task 6 |
| Backend accepts `whatsapp_number` at signup | Task 4 |
| DB CHECK constraint updated | Task 5 |
| ProfileSettings: separate phone + WhatsApp | Task 7 |
| Admin gender options cleaned | Task 3 |
