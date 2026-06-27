"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CircleGauge,
  Loader2,
  Mail,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { ElementType } from "react";
import {
  cancelSubscriptionMutation,
  checkoutMutation,
  startTrialMutation,
  subscriptionQuery,
} from "@/lib/queries";
import { formatEGP } from "@/lib/utils";
import type { SubscriptionStatus } from "@/types/api";
import { useAuthStore } from "@/stores/authStore";
import ContactModal from "@/components/contact/ContactModal";

type PlanKey = "free" | "basic" | "pro";

interface PlanDef {
  key: PlanKey;
  name: string;
  priceMonthly: number;
  listingCap: number;
  aiQuota: number;
  icon: ElementType;
  eyebrow: string;
  summary: string;
  features: string[];
  highlight: boolean;
}

const PLANS: PlanDef[] = [
  {
    key: "free",
    name: "Free",
    priceMonthly: 0,
    listingCap: 1,
    aiQuota: 0,
    icon: Zap,
    eyebrow: "First listing",
    summary: "Publish one property and learn how AXIOM demand behaves.",
    highlight: false,
    features: ["1 active listing", "Standard visibility", "Manual listing copy"],
  },
  {
    key: "basic",
    name: "Basic",
    priceMonthly: 199,
    listingCap: 5,
    aiQuota: 10,
    icon: Star,
    eyebrow: "Best owner fit",
    summary: "For active owners who want stronger placement and AI support.",
    highlight: true,
    features: [
      "5 active listings",
      "10 AI descriptions each month",
      "Priority listing placement",
      "Email support",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    priceMonthly: 499,
    listingCap: 20,
    aiQuota: 50,
    icon: Building2,
    eyebrow: "Portfolio scale",
    summary: "For teams managing multiple homes, rooms, and buyer leads.",
    highlight: false,
    features: [
      "20 active listings",
      "50 AI descriptions each month",
      "Featured listing slots",
      "Analytics dashboard",
      "Priority support",
    ],
  },
];

const FALLBACK_CURRENT_PLAN: SubscriptionStatus["plan"] = "free";
const FALLBACK_SUBSCRIPTION_STATUS: SubscriptionStatus = {
  plan: FALLBACK_CURRENT_PLAN,
  status: null,
  listing_cap: 1,
  active_listings: 0,
  ai_quota: 0,
  ai_used: 0,
  ai_remaining: 0,
  trial_used: false,
  trial_ends_at: null,
  current_period_end: null,
};

const PLAN_RANK: Record<PlanKey, number> = {
  free: 0,
  basic: 1,
  pro: 2,
};

function subscriptionPlanRank(plan: SubscriptionStatus["plan"]) {
  if (plan === "trial") return PLAN_RANK.basic;
  if (plan === "agency") return 3;
  return PLAN_RANK[plan];
}

function formatPlanName(plan: SubscriptionStatus["plan"]) {
  return plan.replace(/_/g, " ");
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";

  return new Date(value).toLocaleDateString("en-EG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPaidPlan(plan: SubscriptionStatus["plan"]) {
  return plan === "basic" || plan === "pro";
}

function LoadingState() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#10100f] px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.35fr] lg:items-end">
          <div className="space-y-5">
            <div className="h-7 w-36 animate-pulse rounded-lg bg-white/10" />
            <div className="h-16 max-w-lg animate-pulse rounded-2xl bg-white/10" />
            <div className="h-20 max-w-xl animate-pulse rounded-2xl bg-white/[0.06]" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="min-h-72 animate-pulse rounded-[1.75rem] border border-white/10 bg-white/[0.04]"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function PlanBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
      {children}
    </span>
  );
}

interface PlanCardProps {
  plan: PlanDef;
  currentPlan: SubscriptionStatus["plan"];
  trialUsed: boolean;
  onStartTrial: () => void;
  onUpgrade: (plan: "basic" | "pro") => void;
  loadingTrial: boolean;
  loadingCheckout: boolean;
  checkoutTarget: "basic" | "pro" | null;
  accountUnavailable: boolean;
}

function PlanCard({
  plan,
  currentPlan,
  trialUsed,
  onStartTrial,
  onUpgrade,
  loadingTrial,
  loadingCheckout,
  checkoutTarget,
  accountUnavailable,
}: PlanCardProps) {
  const isCurrent = currentPlan === plan.key;
  const isTrial = currentPlan === "trial" && plan.key === "basic";
  const isLowerTier =
    !accountUnavailable && subscriptionPlanRank(currentPlan) > PLAN_RANK[plan.key];
  const isRecommended =
    plan.highlight &&
    !isCurrent &&
    !isLowerTier &&
    subscriptionPlanRank(currentPlan) < PLAN_RANK[plan.key];
  const Icon = plan.icon;
  const isBusy = loadingCheckout && checkoutTarget === plan.key;

  return (
    <article
      className={[
        "group relative flex min-h-[31rem] flex-col overflow-hidden rounded-[1.75rem] border p-6 transition-[border-color,background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.995]",
        plan.highlight
          ? "border-primary/45 bg-[#1c1715] shadow-[0_28px_90px_rgba(255,90,60,0.13)] lg:-mt-8"
          : "border-white/10 bg-white/[0.035] hover:border-white/18 hover:bg-white/[0.05]",
        isCurrent || isTrial ? "ring-1 ring-primary/65" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/38">
            {plan.eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {plan.name}
          </h2>
        </div>
        <div
          className={[
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-0.5",
            plan.highlight
              ? "border-primary/35 bg-primary/15 text-primary"
              : "border-white/10 bg-white/[0.045] text-white/62",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-7 min-h-[7.25rem]">
        {plan.priceMonthly === 0 ? (
          <p className="text-4xl font-semibold tracking-tight text-white">Free</p>
        ) : (
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <span className="font-mono text-4xl font-semibold tracking-tight text-white">
              {formatEGP(plan.priceMonthly)}
            </span>
            <span className="mb-1.5 text-sm font-medium text-white/42">per month</span>
          </div>
        )}
        <p className="mt-4 max-w-[28ch] text-sm leading-6 text-white/54">{plan.summary}</p>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-3 border-y border-white/10 py-4">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/32">
            Listings
          </dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-white">
            {plan.listingCap}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/32">
            AI quota
          </dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-white">
            {plan.aiQuota === 0 ? "None" : plan.aiQuota}
          </dd>
        </div>
      </dl>

      <ul className="mt-6 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm leading-5 text-white/72">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
              <Check className="h-3.5 w-3.5" />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        {isRecommended && (
          <div className="mb-3">
            <PlanBadge>Recommended</PlanBadge>
          </div>
        )}

        {isTrial && (
            <p className="mb-2 text-center text-xs text-white/40">
              Converting from trial to paid
            </p>
          )}

        {plan.key !== "free" && !isCurrent && !isLowerTier && (
          <button
            onClick={() => onUpgrade(plan.key as "basic" | "pro")}
            disabled={loadingCheckout || accountUnavailable}
            className={[
              "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-[background-color,border-color,transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60",
              plan.highlight
                ? "bg-primary text-white shadow-[0_18px_38px_rgba(255,90,60,0.22)] hover:bg-primary-hover active:scale-[0.98]"
                : "border border-white/14 bg-white/[0.045] text-white hover:border-white/24 hover:bg-white/[0.08] active:scale-[0.98]",
            ].join(" ")}
          >
            {accountUnavailable ? (
              "Account status unavailable"
            ) : isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting
              </>
            ) : (
              <>
                Upgrade
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        )}

        {isLowerTier && (
          <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm font-medium text-white/42">
            Included in {formatPlanName(currentPlan)}
          </div>
        )}

        {isCurrent && plan.key !== "free" && (
          <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/12 px-4 py-3 text-sm font-semibold text-primary">
            <Check className="h-4 w-4" />
            Active plan
          </div>
        )}

        {plan.key === "free" && isCurrent && !trialUsed && (
          <button
            onClick={onStartTrial}
            disabled={loadingTrial || accountUnavailable}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/12 px-4 py-3 text-sm font-semibold text-primary transition-[background-color,transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-primary/18 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accountUnavailable ? (
              "Account status unavailable"
            ) : loadingTrial ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting trial
              </>
            ) : (
              <>
                Start 7-day Basic trial
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        )}

        {plan.key === "free" && isCurrent && trialUsed && (
          <div className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm font-medium text-white/42">
            Current plan
          </div>
        )}

        {plan.key === "free" && !isCurrent && !isLowerTier && (
          <div className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm font-medium text-white/34">
            Free fallback
          </div>
        )}
      </div>
    </article>
  );
}

function UsageStat({
  label,
  value,
  cap,
}: {
  label: string;
  value: number;
  cap: number | null;
}) {
  const progress = cap ? Math.min(100, Math.round((value / cap) * 100)) : null;

  return (
    <div className="min-w-0 border-t border-white/10 pt-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-white/40">{label}</span>
        <span className="font-mono text-sm font-semibold text-white">
          {value}
          {cap !== null && <span className="text-white/32">/{cap}</span>}
        </span>
      </div>
      {progress !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function CurrentPlanPanel({
  data,
  canCancel,
  cancelSuccess,
  isCancelling,
  onCancel,
  accountUnavailable,
}: {
  data: SubscriptionStatus;
  canCancel: boolean;
  cancelSuccess: boolean;
  isCancelling: boolean;
  onCancel: () => void;
  accountUnavailable: boolean;
}) {
  return (
    <aside className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/34">
            Current plan
          </p>
          <p className="mt-2 text-2xl font-semibold capitalize tracking-tight text-white">
            {accountUnavailable ? "Unavailable" : formatPlanName(data.plan)}
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/24 bg-primary/12 text-primary">
          <CircleGauge className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
        <UsageStat
          label="Active listings"
          value={data.active_listings}
          cap={data.listing_cap === 999 ? null : data.listing_cap}
        />
        <UsageStat
          label="AI descriptions used"
          value={data.ai_used}
          cap={data.ai_quota === 0 ? null : data.ai_quota}
        />
        <UsageStat label="AI remaining" value={data.ai_remaining} cap={null} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-[#11100f] p-4">
        <div className="flex items-center gap-3 text-sm text-white/58">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span>
            {data.plan === "trial"
              ? `Trial ends ${formatDate(data.trial_ends_at)}`
              : accountUnavailable
                ? "Connect to the subscription endpoint to manage plans"
                : `Renewal ${formatDate(data.current_period_end)}`}
          </span>
        </div>
      </div>

      {cancelSuccess && (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-sm leading-6 text-amber-100">
          Cancellation scheduled. Your plan stays active until the current billing
          period ends.
        </div>
      )}

      {canCancel && !cancelSuccess && (
        <button
          onClick={onCancel}
          disabled={isCancelling}
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white/34 underline-offset-4 transition-colors duration-200 hover:text-red-300 hover:underline disabled:opacity-50"
        >
          {isCancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Cancel plan
        </button>
      )}
    </aside>
  );
}

function AgencyPanel() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <section className="mt-12 grid gap-5 rounded-[1.75rem] border border-white/10 bg-[#151413] p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
      <div>
        <p className="text-sm font-semibold text-white">Agency plan</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/52">
          For developers and agencies that need unlimited inventory, a dedicated
          account manager, custom integrations, and SLA support.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setContactOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-white transition-[background-color,border-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-white/24 hover:bg-white/[0.08] active:scale-[0.98]"
      >
        <Mail className="h-4 w-4" />
        Contact us
      </button>
      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        subject="Agency plan enquiry"
        title="Contact our team"
        description="Tell us about your agency and what you need — we'll get back to you about the Agency plan."
      />
    </section>
  );
}

export default function PricingPage() {
  const queryClient = useQueryClient();
  const { user, isInitialized } = useAuthStore();
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<"basic" | "pro" | null>(null);

  const {
    data,
    isError,
    isLoading,
    refetch,
  } = useQuery<SubscriptionStatus>({
    ...subscriptionQuery,
    enabled: isInitialized && !!user,
  });

  const trialMutation = useMutation({
    ...startTrialMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] });
    },
  });

  const upgradeMutation = useMutation({
    ...checkoutMutation,
    onError: () => {
      setCheckoutTarget(null);
    },
    onSuccess: (result) => {
      window.location.href = result.checkout_url;
    },
  });

  const cancelMutation = useMutation({
    ...cancelSubscriptionMutation,
    onSuccess: () => {
      setCancelSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] });
    },
  });

  const handleUpgrade = (plan: "basic" | "pro") => {
    setCheckoutTarget(plan);
    upgradeMutation.mutate(plan);
  };

  if (isLoading) return <LoadingState />;

  const accountUnavailable = isError || !data;
  const displayData = data ?? FALLBACK_SUBSCRIPTION_STATUS;
  const currentPlan = displayData.plan ?? FALLBACK_CURRENT_PLAN;
  const canCancel = !accountUnavailable && isPaidPlan(currentPlan);

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#10100f] px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,90,60,0.13),transparent_30%),radial-gradient(circle_at_80%_8%,rgba(255,255,255,0.08),transparent_24%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative mx-auto max-w-7xl">
        <section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <div className="pb-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/48">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Owner pricing
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-white text-balance sm:text-5xl lg:text-6xl">
              Pay for the selling motion you actually use.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/56">
              Start with one listing, then scale into AI descriptions, stronger
              placement, and portfolio reporting when your inventory needs it.
            </p>
          </div>

          <CurrentPlanPanel
            data={displayData}
            canCancel={canCancel}
            cancelSuccess={cancelSuccess}
            isCancelling={cancelMutation.isPending}
            onCancel={() => cancelMutation.mutate()}
            accountUnavailable={accountUnavailable}
          />
        </section>

        {accountUnavailable && (
          <section className="mt-8 flex flex-col gap-4 rounded-[1.5rem] border border-amber-300/20 bg-amber-300/[0.075] p-5 pr-20 text-amber-50 sm:flex-row sm:items-center sm:justify-between sm:pr-5">
            <div>
              <p className="text-sm font-semibold">Subscription status is unavailable</p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-50/70">
                Plans are visible for review, but trial and checkout actions are
                paused until the subscription endpoint responds.
              </p>
            </div>
            <button
              onClick={() => void refetch()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-100/20 bg-amber-100/10 px-4 py-2.5 text-sm font-semibold text-amber-50 transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-amber-100/15 active:scale-[0.98]"
            >
              Retry
              <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        )}

        <section className="mt-12 grid gap-5 lg:grid-cols-[0.86fr_1.14fr_0.95fr] lg:items-stretch">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              currentPlan={currentPlan}
              trialUsed={displayData.trial_used}
              onStartTrial={() => trialMutation.mutate()}
              onUpgrade={handleUpgrade}
              loadingTrial={trialMutation.isPending}
              loadingCheckout={upgradeMutation.isPending}
              checkoutTarget={checkoutTarget}
              accountUnavailable={accountUnavailable}
            />
          ))}
        </section>

        {upgradeMutation.isError && (
          <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/[0.08] px-4 py-3 text-sm leading-6 text-red-100">
            Checkout could not start. Please check your connection and try again.
          </div>
        )}

        {trialMutation.isError && (
          <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/[0.08] px-4 py-3 text-sm leading-6 text-red-100">
            The trial could not be started. Please try again.
          </div>
        )}

        <AgencyPanel />
      </div>
    </main>
  );
}
