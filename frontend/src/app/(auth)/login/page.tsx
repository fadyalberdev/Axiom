import type { Metadata } from "next";
import AuthProductPreview from "@/components/auth/AuthProductPreview";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log In — Axiom",
  description: "Log in to your Axiom account to find your perfect home.",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-[calc(100dvh-64px)] flex-grow items-stretch overflow-hidden bg-[#0f0f0f]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_76%_16%,rgba(255,90,60,0.12),transparent_24%),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.024)_1px,transparent_1px)] bg-[size:auto,56px_56px,56px_56px]" />

      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-12">
        <AuthProductPreview mode="login" />

        <LoginForm />
      </section>
    </main>
  );
}
