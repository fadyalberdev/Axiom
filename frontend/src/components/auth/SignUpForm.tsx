"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import OAuthButton from "@/components/auth/OAuthButton";
import { GoogleIcon } from "@/components/auth/OAuthIcons";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { buildE164, EGYPT_PHONE_REGEX } from "@/lib/phoneUtils";
import { PASSWORD_REQUIREMENTS, validatePassword } from "@/lib/passwordUtils";
import type { GenderType } from "@/types";

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
const STRENGTH_COLOR = ["", "bg-red-400", "bg-amber-300", "bg-emerald-300"] as const;

export default function SignUpForm() {
  const router = useRouter();
  const { signup, isLoading } = useAuthStore();

  const [phoneInput, setPhoneInput] = useState("");
  const [gender, setGender] = useState<GenderType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const fd = new FormData(e.currentTarget);
    const full_name = (fd.get("name") as string).trim();
    const email = (fd.get("email") as string).trim();
    const submittedPhone = ((fd.get("phone") as string) || phoneInput).trim();
    const confirmPassword = fd.get("confirm-password") as string;
    const tosAccepted = fd.get("tos") === "on";
    const egyptianPhone = submittedPhone.replace(/\D/g, "");
    const submittedE164Phone = buildE164("+20", egyptianPhone);

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
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (!submittedPhone) {
      setError("Phone number is required.");
      return;
    }
    if (!EGYPT_PHONE_REGEX.test(egyptianPhone)) {
      setError("Phone number must be a valid Egyptian number (e.g. 01012345678).");
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
        phone: submittedE164Phone || undefined,
        country_code: "+20",
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
      <div className="mx-auto w-full max-w-xl rounded-lg border border-white/10 bg-[#171717]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur sm:p-7">
        <div className="mb-7 flex items-start justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              AXIOM
            </p>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Create your account
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/60">
              One profile for listings, saved searches, and recommendations.
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

        {info && (
          <div className="mb-5 rounded-lg border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
            {info}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="on">
          <div className="order-1">
            <label htmlFor="name" className={labelClass}>
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="section-signup name"
              required
              placeholder="Ahmed Mohamed"
              className={inputClass}
            />
          </div>

          <div className="order-2">
            <label htmlFor="signup-email" className={labelClass}>
              Email Address
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@example.com"
              className={inputClass}
            />
          </div>

          <div className="order-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              Gender <span className="text-primary">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {GENDER_OPTIONS.map((g) => (
                <label
                  key={g.value}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.98] ${
                    gender === g.value
                      ? "border-primary/70 bg-primary/10 text-white"
                      : "border-white/10 bg-[#101010] text-white/60 hover:border-white/20"
                  }`}
                >
                  <span>{g.label}</span>
                  <input
                    type="radio"
                    name="gender"
                    value={g.value}
                    checked={gender === g.value}
                    onChange={() => setGender(g.value)}
                    className="sr-only"
                  />
                  {gender === g.value && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                </label>
              ))}
            </div>
          </div>

          <div className="order-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="signup-password" className={labelClass}>
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex h-1 gap-1">
                    {([1, 2, 3] as const).map((level) => (
                      <div
                        key={level}
                        className={`flex-1 rounded-full transition-colors duration-150 ${
                          passwordStrength >= level ? STRENGTH_COLOR[passwordStrength] : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-white/50">{STRENGTH_LABEL[passwordStrength]}</p>
                </div>
              )}
              {password.length === 0 && (
                <p className="mt-2 text-xs leading-5 text-white/40">{PASSWORD_REQUIREMENTS}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirm-password" className={labelClass}>
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="Confirm"
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className={iconButtonClass}
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="order-3">
            <label htmlFor="phone" className={labelClass}>
              Phone Number <span className="text-primary">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={11}
              placeholder="01012345678"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onInput={(e) => setPhoneInput(e.currentTarget.value)}
              className={inputClass}
            />
          </div>

          <div className="order-6 pt-1">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="tos"
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#101010] text-primary focus:ring-primary/40"
              />
              <span className="text-sm leading-6 text-white/50">
                I agree to the{" "}
                <Link href="/terms" className="font-medium text-primary transition-colors duration-150 hover:text-primary-hover">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-medium text-primary transition-colors duration-150 hover:text-primary-hover">
                  Privacy Policy
                </Link>
              </span>
            </label>
          </div>

          <div className="order-7 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(255,90,60,0.22)] transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Creating account..." : "Sign Up"}
              {!isLoading && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
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

        <div className="grid grid-cols-1 gap-3">
          <OAuthButton provider="google" label="Google" icon={<GoogleIcon />} />
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-white/50">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary transition-colors duration-150 hover:text-primary-hover">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
