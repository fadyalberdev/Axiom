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
