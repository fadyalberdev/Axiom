export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Isolated layout — no Navbar, no Footer
  return <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>;
}
