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

        <div className="grid grid-cols-1 gap-3">
          <OAuthButton provider="google" label="Google" icon={<GoogleIcon />} />
        </div>

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
