"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Search,
  LogIn,
  UserPlus,
  Menu,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  Home,
  UsersRound,
  Building2,
  BookOpenText,
  Info,
  ArrowRight,
  X,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { subscriptionQuery } from "@/lib/queries";
import TierBadge from "@/components/ui/TierBadge";

interface NavbarProps {
  variant?: "overlay" | "sticky";
}

export default function Navbar({ variant = "overlay" }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isInitialized } = useAuthStore();
  const { data: sub } = useQuery({
    ...subscriptionQuery,
    enabled: isInitialized && !!user,
  });

  const isSticky = variant === "sticky";

  const dashboardHref = "/dashboard";

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  function handleNavSearchSubmit() {
    if (!navSearch.trim()) return;

    router.push(`/find-homes?q=${encodeURIComponent(navSearch.trim())}`);
    setNavSearch("");
    setOpen(false);
  }

  function renderMobileNavIcon(label: string) {
    switch (label) {
      case "Find Homes":
        return <Home className="h-4 w-4" />;
      case "Shared Housing":
        return <UsersRound className="h-4 w-4" />;
      case "Agencies":
        return <Building2 className="h-4 w-4" />;
      case "Blog":
        return <BookOpenText className="h-4 w-4" />;
      case "About Us":
        return <Info className="h-4 w-4" />;
      default:
        return <ArrowRight className="h-4 w-4" />;
    }
  }

  return (
    <nav
      className={
        isSticky
          ? "sticky top-0 w-full z-50 border-b border-white/10 bg-black/40 backdrop-blur-md"
          : "absolute top-0 w-full z-50 border-b border-white/10 bg-black/20 backdrop-blur-sm"
      }
    >
      <div
        className={`mx-auto px-4 sm:px-6 lg:px-8 ${isSticky ? "max-w-[1600px]" : "max-w-7xl"}`}
      >
        <div
          className={`flex items-center justify-between ${isSticky ? "h-16" : "h-20"}`}
        >
          {/* Logo + nav links */}
          <div className="flex items-center gap-12">
            <Link
              href="/"
              className="text-2xl font-bold text-primary tracking-tighter"
            >
              AXIOM
            </Link>
            <div
              className={`hidden md:flex space-x-8 text-sm font-medium text-gray-300 ${isSticky ? "h-16 items-center" : ""}`}
            >
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      isSticky
                        ? `h-full flex items-center pt-1 border-b-2 transition-colors ${
                            isActive
                              ? "text-white border-primary"
                              : "border-transparent hover:text-white hover:border-white/20"
                          }`
                        : `hover:text-white transition-colors ${isActive ? "text-white" : ""}`
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative hidden lg:block">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-gray-400" />
              </span>
              <Input
                type="text"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && navSearch.trim()) {
                    handleNavSearchSubmit();
                  }
                }}
                placeholder="Search city, neighborhood..."
                className={`bg-white/10 border-none text-white text-sm rounded-full pl-10 pr-4 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary w-64 ${isSticky ? "py-1.5" : "py-2 backdrop-blur-md"}`}
              />
            </div>

            {/* Auth: logged out */}
            {!user && (
              <div className="hidden sm:flex items-center gap-4 text-sm font-medium">
                <Link
                  href="/login"
                  className="text-white hover:text-primary flex items-center gap-1 transition-colors"
                >
                  <LogIn className="h-4 w-4" /> Log In
                </Link>
                <Link
                  href="/signup"
                  className="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-full transition-colors flex items-center gap-1"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Sign Up
                </Link>
              </div>
            )}

            {/* Auth: logged in — avatar + premium dropdown */}
            {user && (
              <div className="hidden sm:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 group outline-none">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full border-2 border-primary/40 group-hover:border-primary transition-colors overflow-hidden flex-shrink-0 flex items-center justify-center bg-primary/20">
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt={user.full_name ?? "User"}
                            width={36}
                            height={36}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <span className="text-xs font-bold text-primary">
                            {initials}
                          </span>
                        )}
                      </div>
                      <div className="hidden lg:flex lg:items-center lg:gap-1.5">
                        <span className="text-sm font-medium text-white max-w-[90px] truncate">
                          {user.full_name ?? user.email}
                        </span>
                        {sub && <TierBadge plan={sub.plan} />}
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-data-[state=open]:rotate-180 transition-transform hidden lg:block" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    sideOffset={10}
                    className="w-60 bg-card-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-1"
                  >
                    {/* Header */}
                    <DropdownMenuLabel className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-primary/30 overflow-hidden flex items-center justify-center bg-primary/20 flex-shrink-0">
                          {user.avatar_url ? (
                            <Image
                              src={user.avatar_url}
                              alt={user.full_name ?? "User"}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            <span className="text-sm font-bold text-primary">
                              {initials}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-white truncate">
                              {user.full_name ?? "User"}
                            </p>
                            {sub && <TierBadge plan={sub.plan} />}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-400 truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator className="bg-white/5 mx-2" />

                    <DropdownMenuItem asChild>
                      <Link
                        href={dashboardHref}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-200 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="bg-white/5 mx-2" />

                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Mobile menu */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-white"
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                showCloseButton={false}
                className="w-[min(88vw,22rem)] overflow-hidden border-l border-white/10 bg-[#090b10] p-0 text-white shadow-2xl shadow-black/70"
              >
                <div className="pointer-events-none absolute inset-0" />

                <div className="relative flex min-h-full flex-col">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="border-b border-white/10 px-5 pb-5 pt-6">
                    <SheetTitle className="text-2xl font-bold tracking-tighter text-primary">
                      AXIOM
                    </SheetTitle>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-white/35">
                      Real estate made sharper
                    </p>

                    <div className="relative mt-5">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <Search className="h-4 w-4 text-white/40" />
                      </span>
                      <Input
                        type="text"
                        value={navSearch}
                        onChange={(e) => setNavSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleNavSearchSubmit();
                          }
                        }}
                        placeholder="Search city, neighborhood..."
                        className="h-11 rounded-xl border border-white/10 bg-white/[0.07] pl-10 pr-11 text-sm text-white placeholder:text-white/35 focus-visible:ring-1 focus-visible:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={handleNavSearchSubmit}
                        aria-label="Search"
                        className="absolute inset-y-1 right-1 flex w-9 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary-hover"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
                    {NAV_ITEMS.map((item) => {
                      const itemPath = item.href.split("?")[0];
                      const isActive =
                        pathname === itemPath ||
                        pathname.startsWith(itemPath + "/");

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`group flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                            isActive
                              ? "border-primary/40 bg-primary/15 text-white"
                              : "border-white/5 bg-white/[0.035] text-white/70 hover:border-white/15 hover:bg-white/[0.07] hover:text-white"
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                              isActive
                                ? "bg-primary text-white"
                                : "bg-white/5 text-primary group-hover:bg-primary/15"
                            }`}
                          >
                            {renderMobileNavIcon(item.label)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="border-t border-white/10 bg-black/20 p-4">
                    {user ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/15">
                            {user.avatar_url ? (
                              <Image
                                src={user.avatar_url}
                                alt={user.full_name ?? "User"}
                                width={40}
                                height={40}
                                className="h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-bold text-primary">
                                {initials}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-white">
                                {user.full_name ?? "User"}
                              </p>
                              {sub && <TierBadge plan={sub.plan} />}
                            </div>
                            <p className="truncate text-xs text-white/45">
                              {user.email}
                            </p>
                          </div>
                        </div>

                        <Link
                          href={dashboardHref}
                          onClick={() => setOpen(false)}
                          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Dashboard
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            handleLogout();
                          }}
                          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200"
                        >
                          <LogOut className="h-4 w-4" />
                          Log Out
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href="/login"
                          onClick={() => setOpen(false)}
                          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
                        >
                          <LogIn className="h-4 w-4" />
                          Log In
                        </Link>
                        <Link
                          href="/signup"
                          onClick={() => setOpen(false)}
                          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                        >
                          <UserPlus className="h-4 w-4" />
                          Sign Up
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
