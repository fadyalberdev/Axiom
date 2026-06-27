import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy — AXIOM",
  description: "How AXIOM uses cookies and similar tracking technologies.",
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary mb-4">Legal</p>
        <h1 className="text-3xl font-black tracking-tight text-white mb-2">Cookie Policy</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: June 2026</p>
        <div className="space-y-8 text-white/70 leading-relaxed text-sm">
          <section>
            <h2 className="text-white font-bold text-lg mb-3">1. What Are Cookies</h2>
            <p>Cookies are small text files stored on your device when you visit AXIOM. They help keep you signed in and remember your preferences.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">2. Cookies We Use</h2>
            <p><strong className="text-white">Authentication cookies:</strong> Required to keep you signed in (session tokens).</p>
            <p className="mt-2"><strong className="text-white">Preference cookies:</strong> Remember your search filters and UI settings.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">3. Managing Cookies</h2>
            <p>You can disable cookies in your browser settings. Disabling authentication cookies will prevent you from staying signed in.</p>
          </section>
          <section>
            <h2 className="text-white font-bold text-lg mb-3">4. Contact</h2>
            <p>For cookie questions, contact <a href="mailto:support@axiom.eg" className="text-primary hover:underline">support@axiom.eg</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
