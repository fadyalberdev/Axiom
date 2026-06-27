import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions — AXIOM",
  description: "Terms and conditions for using the AXIOM real estate platform.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary mb-4">Legal</p>
        <h1 className="text-3xl font-black tracking-tight text-white mb-2">Terms &amp; Conditions</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: June 2026</p>
        <div className="space-y-8 text-white/70 leading-relaxed text-sm">
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
