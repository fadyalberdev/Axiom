import type { Metadata } from "next";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set New Password - Axiom",
  description: "Set a new password after verifying your Axiom recovery session.",
};

export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-[calc(100vh-64px)] flex-grow items-center justify-center overflow-hidden bg-[#0f0f0f] px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(255,90,60,0.14),transparent_25%),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:auto,56px_56px,56px_56px]" />
      <ResetPasswordForm />
    </main>
  );
}
