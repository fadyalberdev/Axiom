"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface PhoneOTPInputProps {
  phone: string;           // E.164 format: +201234567890
  onVerified: () => void;  // called when verification succeeds
  onReset: () => void;     // called when user wants to change phone
}

type OTPState = "sending" | "awaiting" | "verifying" | "verified" | "error";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const RESEND_SECONDS = 60;

export default function PhoneOTPInput({ phone, onVerified, onReset }: PhoneOTPInputProps) {
  const [state, setState] = useState<OTPState>("sending");
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Send OTP on mount
  useEffect(() => {
    sendOTP();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus input when awaiting code
  useEffect(() => {
    if (state === "awaiting") {
      inputRef.current?.focus();
    }
  }, [state]);

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  async function sendOTP() {
    setState("sending");
    setErrorMsg(null);
    setCode("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-phone-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { detail?: string }).detail || "Failed to send code");
      }
      setState("awaiting");
      setResendTimer(RESEND_SECONDS);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send code");
      setState("error");
    }
  }

  async function verifyCode(value: string) {
    if (value.length < 6 || state === "verifying") return;
    setState("verifying");
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-phone-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { detail?: string }).detail || "Invalid code");
      }
      setState("verified");
      onVerified();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Invalid code");
      setState("awaiting");
      setCode("");
      inputRef.current?.focus();
    }
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
    if (value.length === 6) {
      verifyCode(value);
    }
  }

  if (state === "verified") {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm mt-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Phone verified</span>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      {state === "sending" && (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Sending code to {phone}…</span>
        </div>
      )}

      {(state === "awaiting" || state === "verifying" || state === "error") && (
        <>
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={handleCodeChange}
              disabled={state === "verifying"}
              placeholder="6-digit code"
              className="w-36 px-4 py-2 rounded-lg border border-white/10 bg-background-dark text-white placeholder-gray-500 text-center tracking-[0.4em] text-lg font-mono focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
            />
            {state === "verifying" && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-500">
            {resendTimer > 0 ? (
              <span>Resend in {resendTimer}s</span>
            ) : (
              <button
                type="button"
                onClick={sendOTP}
                className="text-primary hover:text-primary-hover transition-colors"
              >
                Resend code
              </button>
            )}
            <span>·</span>
            <button
              type="button"
              onClick={onReset}
              className="hover:text-gray-300 transition-colors"
            >
              Change number
            </button>
          </div>
        </>
      )}
    </div>
  );
}
