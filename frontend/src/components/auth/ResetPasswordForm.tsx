"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PASSWORD_REQUIREMENTS, validatePassword } from "@/lib/passwordUtils";
import { useAuthStore } from "@/stores/authStore";

type SessionState = "checking" | "ready" | "invalid";

const inputClass =
  "auth-field block w-full rounded-lg border border-white/10 bg-[#101010] py-3 pl-10 pr-10 text-sm text-white placeholder:text-white/28 outline-none transition-[border-color,background-color,box-shadow] duration-150 focus:border-primary/70 focus:bg-[#121212] focus:shadow-[0_0_0_3px_rgba(255,90,60,0.12)]";
const RECOVERY_SESSION_KEY = "axiom:password-recovery";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>("checking");

  useEffect(() => {
    let resolved = false;
    const hasRecoveryUrl =
      window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery");

    const markReady = (source: "email" | "phone") => {
      if (resolved) return;
      resolved = true;
      window.sessionStorage.setItem(RECOVERY_SESSION_KEY, source);
      setSessionState("ready");
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      const source = window.sessionStorage.getItem(RECOVERY_SESSION_KEY);
      if (session && (source || hasRecoveryUrl)) {
        markReady(source === "phone" ? "phone" : "email");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        event === "PASSWORD_RECOVERY"
      ) {
        markReady("email");
      }
      if (
        session &&
        window.sessionStorage.getItem(RECOVERY_SESSION_KEY) === "phone" &&
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
      ) {
        markReady("phone");
      }
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setSessionState("invalid");
      }
    }, 3500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirm = fd.get("confirm") as string;

    if (!password || !confirm) {
      setError("Please fill in both fields.");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your reset session expired. Request a new reset link or code.");

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);

      window.sessionStorage.removeItem(RECOVERY_SESSION_KEY);
      setSuccess(true);
      toast.success("Password updated successfully.");
      await useAuthStore.getState().refreshProfile();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  if (sessionState === "checking") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="rounded-[1.25rem] border border-white/10 bg-[#151515] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-10">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-white/52">Verifying your reset session...</p>
        </div>
      </motion.div>
    );
  }

  if (sessionState === "invalid") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="rounded-[1.25rem] border border-white/10 bg-[#151515] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10">
            <AlertTriangle className="h-7 w-7 text-amber-300" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Link expired or invalid
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/50">
            Request a new email reset link or phone code before setting a new password.
          </p>
          <Link
            href="/forgot-password"
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-black text-white shadow-[0_16px_36px_rgba(255,90,60,0.18)] transition-[background-color,transform] duration-150 hover:bg-primary-hover active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to recovery
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <div className="rounded-[1.25rem] border border-white/10 bg-[#151515] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-10">
        {success ? (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-300" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Password updated
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/50">
              Your password has been changed successfully.
            </p>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-black text-white shadow-[0_16px_36px_rgba(255,90,60,0.18)] transition-[background-color,transform] duration-150 hover:bg-primary-hover active:scale-[0.98]"
            >
              Go to dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="mb-7 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                <ShieldCheck className="h-7 w-7 text-primary" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Secure reset
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
                Set a new password
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/50">
                Choose a new password for the verified recovery session.
              </p>
            </div>

            {error && (
              <p className="mb-5 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/42"
                >
                  New password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/32" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="Enter new password"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-white/36 transition-colors hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/40">
                  {PASSWORD_REQUIREMENTS}
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirm"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/42"
                >
                  Confirm new password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/32" />
                  <input
                    id="confirm"
                    name="confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="Confirm new password"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-white/36 transition-colors hover:text-white"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-black text-white shadow-[0_16px_36px_rgba(255,90,60,0.18)] transition-[background-color,transform,opacity] duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? "Updating..." : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </motion.div>
  );
}
