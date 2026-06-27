import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — AXIOM",
  description: "How AXIOM collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary mb-4">Legal</p>
        <h1 className="text-3xl font-black tracking-tight text-white mb-2">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: June 2026</p>
        <div className="space-y-8 text-white/70 leading-relaxed text-sm">
          <section>
            <h2 className="text-white font-bold text-lg mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly: name, email, phone number, and property preferences. We also collect usage data when you interact with AXIOM.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">2. How We Use Your Information</h2>
            <p>Your data is used to operate and improve the platform, match listings to your preferences, process payments, and communicate service updates. We do not sell your personal information.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">3. Data Storage</h2>
            <p>Data is stored securely with industry-standard encryption in transit and at rest.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">4. Your Rights</h2>
            <p>You may request access to, correction of, or deletion of your personal data by contacting us at <a href="mailto:support@axiom.eg" className="text-primary hover:underline">support@axiom.eg</a>.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">5. Contact</h2>
            <p>For privacy questions, contact <a href="mailto:support@axiom.eg" className="text-primary hover:underline">support@axiom.eg</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
