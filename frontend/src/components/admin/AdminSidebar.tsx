"use client";

import type { ElementType } from "react";
import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/admin/api";
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderOpen,
  Home,
  FileText,
  Clock,
  LogOut,
  ShieldCheck,
  PhoneCall,
  GraduationCap,
} from "lucide-react";

type NavItem = {
  id: string;
  label: string;
  icon: ElementType;
  alert?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People",
    items: [
      { id: "users", label: "Users", icon: Users },
    ],
  },
  {
    label: "Properties",
    items: [
      { id: "listings", label: "Listings", icon: Home },
      { id: "pending-approvals", label: "Pending Approvals", icon: Clock, alert: true },
      { id: "projects", label: "Projects", icon: FolderOpen },
    ],
  },
  {
    label: "Business",
    items: [
      { id: "agencies", label: "Agencies", icon: Building2 },
      { id: "universities", label: "Universities", icon: GraduationCap },
      { id: "leads", label: "Leads", icon: PhoneCall },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "blog", label: "Blog Posts", icon: FileText },
    ],
  },
];

interface Props {
  active: string;
  onNavigate: (section: string) => void;
}

export default function AdminSidebar({ active, onNavigate }: Props) {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.replace("/admin/login");
  }

  return (
    <aside className="flex h-full w-64 flex-col bg-zinc-950 text-zinc-100">
      {/* Logo */}
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-600 shadow-[0_14px_35px_-18px_rgba(255,90,60,0.95)]">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wide text-white">AXIOM</span>
              <span className="rounded-full border border-orange-400/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-200">
                Admin
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500">Live operations</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map(({ label, items }) => (
          <div key={label}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(({ id, label: itemLabel, icon: Icon, alert }) => {
                const isActive = active === id;
                return (
                  <button
                    key={id}
                    onClick={() => onNavigate(id)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-[background-color,color,transform,box-shadow] active:scale-[0.98] ${
                      isActive
                        ? "bg-orange-600 text-white shadow-[0_18px_34px_-22px_rgba(255,90,60,0.9)]"
                        : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 flex-shrink-0 transition-colors ${
                        isActive ? "text-white" : "text-zinc-600 group-hover:text-zinc-300"
                      }`}
                    />
                    <span className="flex-1">{itemLabel}</span>
                    {alert && (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-orange-400 shadow-[0_0_0_4px_rgba(251,146,60,0.12)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-white ring-1 ring-white/10">
            A
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">Admin</p>
            <p className="text-zinc-500 text-xs">Super Admin</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-400 transition-[background-color,color,transform] hover:bg-red-950/30 hover:text-red-300 active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
