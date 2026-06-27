"use client";

type Plan = "free" | "trial" | "basic" | "pro" | "agency";

interface TierBadgeProps {
  plan: Plan | string;
  size?: "xs" | "sm";
  className?: string;
}

const PLAN_CONFIG: Record<string, { label: string; className: string }> = {
  free:   { label: "Free",   className: "border-white/10 bg-white/5 text-white/50" },
  trial:  { label: "Trial",  className: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  basic:  { label: "Basic",  className: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  pro:    { label: "Pro",    className: "border-violet-400/30 bg-violet-400/10 text-violet-300" },
  agency: { label: "Agency", className: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300" },
};

export default function TierBadge({ plan, size = "xs", className = "" }: TierBadgeProps) {
  const config = PLAN_CONFIG[plan] ?? PLAN_CONFIG.free;
  const sizeClass = size === "sm"
    ? "px-2.5 py-0.5 text-[11px] font-semibold"
    : "px-2 py-0.5 text-[10px] font-bold";

  return (
    <span
      className={`inline-flex items-center rounded-full border tracking-wide uppercase ${sizeClass} ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}
