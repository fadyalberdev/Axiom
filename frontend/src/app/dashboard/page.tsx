"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardStats from "@/components/dashboard/DashboardStats";
import MyListings from "@/components/dashboard/MyListings";
import dynamic from "next/dynamic";
const AddListingModal = dynamic(() => import("@/components/dashboard/AddListingModal"), { ssr: false });
import LikedProperties from "@/components/dashboard/LikedProperties";
import ProfileSettings from "@/components/dashboard/ProfileSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardQueries, subscriptionQuery } from "@/lib/queries";
import { getListingPriceSuffix } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Home, Plus, Sparkles } from "lucide-react";
import TierBadge from "@/components/ui/TierBadge";
import type { ApiAnalyticsStat, ApiDashboardListing } from "@/types/api";
import type {
  AnalyticsStat,
  DashboardListing,
} from "@/types";

// Mappers

function mapListing(listing: ApiDashboardListing): DashboardListing {
  const statusMap: Record<string, DashboardListing["status"]> = {
    active: "active",
    pending: "pending",
    rejected: "rejected",
    draft: "draft",
  };
  return {
    id: listing.id,
    name: listing.title,
    listingId: `LIST-${listing.id.slice(0, 6).toUpperCase()}`,
    image: listing.images[0] ?? undefined,
    location: listing.full_address || listing.location,
    status: statusMap[listing.status] ?? "draft",
    price: `EGP ${listing.price.toLocaleString()}`,
    priceSuffix: getListingPriceSuffix(listing.category),
    views: `${listing.views_count}`,
  };
}

function mapAnalytics(stat: ApiAnalyticsStat): AnalyticsStat {
  const iconMap: Record<string, string> = {
    "Total Views": "Eye",
    "Active Listings": "TrendingUp",
    "Pending Approval": "Clock",
    "Saved Properties": "Heart",
  };
  const colorMap: Record<string, Pick<AnalyticsStat, "iconBg" | "iconColor" | "barColor">> = {
    "Total Views": {
      iconBg: "bg-sky-400/10",
      iconColor: "text-sky-300",
      barColor: "bg-sky-400",
    },
    "Active Listings": {
      iconBg: "bg-teal-400/10",
      iconColor: "text-teal-300",
      barColor: "bg-teal-400",
    },
    "Pending Approval": {
      iconBg: "bg-amber-400/10",
      iconColor: "text-amber-300",
      barColor: "bg-amber-400",
    },
    "Saved Properties": {
      iconBg: "bg-rose-400/10",
      iconColor: "text-rose-300",
      barColor: "bg-rose-400",
    },
  };

  return {
    label: stat.label,
    value: stat.value,
    icon: iconMap[stat.label] ?? "Activity",
    ...(colorMap[stat.label] ?? {
      iconBg: "bg-zinc-400/10",
      iconColor: "text-zinc-300",
      barColor: "bg-zinc-400",
    }),
    bars: [26, 44, 36, 58, 49, 72, 63],
    trendPercent: `${Math.abs(stat.trend_percent)}%`,
    trendUp: stat.label === "Pending Approval" ? !stat.trend_up : stat.trend_up,
  };
}

// Page

interface MyAgencyResponse {
  agency: { id: string; name: string; slug: string } | null;
  projects: { id: string; title: string }[];
}

export default function DashboardPage() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const { data, isLoading, isError } = useQuery({
    ...dashboardQueries.me(),
    enabled: !!user?.id,
  });
  // The user's own agency (admin-assigned) and its projects, if any. Lets an
  // agency owner attach a new listing to one of their agency's projects.
  const { data: myAgency } = useQuery({
    queryKey: ["agencies", "mine"],
    queryFn: () => api.get<MyAgencyResponse>("/api/agencies/mine"),
    enabled: !!user?.id,
  });
  const agencyProjects = myAgency?.projects ?? [];
  const { data: sub } = useQuery({
    ...subscriptionQuery,
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (isInitialized && !user) {
      router.replace("/login?redirect=/dashboard");
    }
  }, [isInitialized, user, router]);

  useEffect(() => {
    if (searchParams.get("sub") === "success") {
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] });
    }
  }, [searchParams, queryClient]);

  if (!isInitialized || isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="mb-8 h-72 rounded-[1.75rem] bg-white/10" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28 rounded-2xl bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-8">
          <h1 className="text-2xl font-semibold text-white">Dashboard data could not load</h1>
          <p className="mt-2 text-sm text-red-100">
            Please refresh the page or sign in again.
          </p>
        </div>
      </div>
    );
  }

  const analyticsStats: AnalyticsStat[] = data.analytics.map(mapAnalytics);

  const listings = (data?.listings ?? []).map(mapListing);

  return (
    <div className="relative min-h-[calc(100dvh-64px)] overflow-hidden bg-[#0f0f0f]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,90,60,0.14),transparent_25%),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:auto,56px_56px,56px_56px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 2xl:max-w-[1600px]">
        <div className="mb-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#151515]/94 p-2 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
          <div className="rounded-[1.35rem] border border-white/10 bg-[#101010] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    User dashboard
                  </div>
                  {sub && <TierBadge plan={sub.plan} size="sm" />}
                </div>
                <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Manage your AXIOM workspace.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
                  {data.profile.full_name || data.profile.email}, keep your profile, listing pipeline, and saved homes in one place.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 lg:min-w-[360px]">
                {[
                  ["Listings", data.listings_count],
                  ["Saved", data.liked_count],
                  ["Pending", data.pending_count],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl font-black tabular-nums text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-black text-white shadow-[0_16px_36px_rgba(255,90,60,0.18)] transition-[background-color,transform,opacity] duration-150 ease-out hover:bg-primary-hover active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Add listing
              </button>
              <button
                type="button"
                onClick={() => router.push("/find-homes")}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-bold text-white/72 transition-[border-color,background-color,transform] duration-150 ease-out hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.98]"
              >
                <Home className="h-4 w-4 text-primary" />
                Browse homes
              </button>
            </div>
          </div>
        </div>

        <ProfileSettings
          profile={data.profile}
          listingsCount={data.listings_count}
          likedCount={data.liked_count}
          pendingCount={data.pending_count}
        />
        <DashboardStats stats={analyticsStats} listingCap={sub?.listing_cap} />

        <Tabs defaultValue="listings" className="space-y-5">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[1.25rem] border border-white/10 bg-[#151515] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <TabsTrigger value="listings" className="rounded-lg px-3 py-2 data-[state=active]:border-primary/30 data-[state=active]:bg-primary/12 data-[state=active]:text-white">Listings</TabsTrigger>
            <TabsTrigger value="liked" className="rounded-lg px-3 py-2 data-[state=active]:border-primary/30 data-[state=active]:bg-primary/12 data-[state=active]:text-white">Saved</TabsTrigger>
          </TabsList>
          <TabsContent value="listings">
            <MyListings listings={listings} onAddNew={() => setModalOpen(true)} />
          </TabsContent>
          <TabsContent value="liked">
            <LikedProperties />
          </TabsContent>
        </Tabs>
        <AddListingModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setProjectId("");
          }}
          onSuccess={() => {
            setProjectId("");
            queryClient.invalidateQueries({ queryKey: ["dashboard", "me"] });
          }}
          getAdditionalPayload={
            agencyProjects.length > 0
              ? () => (projectId ? { project_id: projectId } : {})
              : undefined
          }
          renderBeforeBasics={
            agencyProjects.length > 0 ? (
              <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <label className="block text-sm font-medium text-gray-300">
                  Project <span className="text-gray-500">(optional)</span>
                </label>
                <p className="text-xs text-gray-500">
                  Link this listing to one of {myAgency?.agency?.name ?? "your agency"}&apos;s projects.
                </p>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-input-dark px-4 py-3 text-sm text-white transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">— No project —</option>
                  {agencyProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </section>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
