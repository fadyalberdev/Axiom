import type { Metadata } from "next";
import AuthProductPreview from "@/components/auth/AuthProductPreview";
import SignUpForm from "@/components/auth/SignUpForm";

export const metadata: Metadata = {
  title: "Sign Up — Axiom",
  description:
    "Create your Axiom account and find homes that match your vibe.",
};

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-[calc(100dvh-64px)] flex-grow items-stretch overflow-hidden bg-[#0f0f0f]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_22%,rgba(255,90,60,0.13),transparent_24%),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:auto,56px_56px,56px_56px]" />

      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.98fr_1.02fr] lg:px-8 lg:py-12">
        <AuthProductPreview mode="signup" />

        <SignUpForm />
      </section>
    </main>
  );
}
