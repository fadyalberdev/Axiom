import Link from "next/link";
import AuthRedirectGuard from "@/components/auth/AuthRedirectGuard";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background-dark flex flex-col">
      {/* Logo-only header */}
      <header className="w-full flex items-center justify-center h-16 border-b border-white/5">
        <Link
          href="/"
          className="text-2xl font-bold text-primary tracking-tighter hover:opacity-80 transition-opacity"
        >
          AXIOM
        </Link>
      </header>
      <main className="flex-1">
        <AuthRedirectGuard>{children}</AuthRedirectGuard>
      </main>
    </div>
  );
}
