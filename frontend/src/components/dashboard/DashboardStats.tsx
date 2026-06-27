// V2/frontend/src/components/dashboard/DashboardStats.tsx
"use client";

import type { ElementType } from "react";
import { Activity, Clock, Eye, Heart, MessageSquare, TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import type { AnalyticsStat } from "@/types";

interface DashboardStatsProps {
  stats: AnalyticsStat[];
  listingCap?: number;
}

const ICON_MAP: Record<string, ElementType> = {
  Eye,
  Activity,
  Clock,
  Heart,
  TrendingUp,
  MessageSquare,
};

function getNumericValue(value: string | number) {
  if (typeof value === "number") return value;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getHealth(stat: AnalyticsStat, listingCap?: number) {
  const value = getNumericValue(stat.value);
  const label = stat.label.toLowerCase();

  if (label.includes("pending")) {
    const percent = Math.max(0, Math.min(100, (value / 5) * 100));
    return {
      label: value === 0 ? "Queue clear" : "Queue load",
      percent,
      detail: value === 0 ? "No items waiting" : `${value} waiting`,
    };
  }

  if (label.includes("active")) {
    const cap = listingCap ?? 10;
    return {
      label: "Portfolio depth",
      percent: Math.max(0, Math.min(100, (value / cap) * 100)),
      detail: `${value} of ${cap} target`,
    };
  }

  if (label.includes("saved")) {
    return {
      label: "Shortlist depth",
      percent: Math.max(0, Math.min(100, (value / 10) * 100)),
      detail: `${value} saved`,
    };
  }

  return {
    label: "Activity level",
    percent: Math.max(0, Math.min(100, (value / 100) * 100)),
    detail: `${value} views`,
  };
}

export default function DashboardStats({ stats, listingCap }: DashboardStatsProps) {
  if (!stats.length) return null;

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = ICON_MAP[stat.icon] ?? Eye;
        const health = getHealth(stat, listingCap);
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] }}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-[#151515] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,transform,background-color] duration-150 ease-out hover:border-white/16 hover:bg-[#181818] active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className={`rounded-xl p-3 ${stat.iconBg}`}>
                <Icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
              {stat.trendPercent && stat.trendPercent !== "0%" && stat.trendPercent !== "0" && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${
                    stat.trendUp
                      ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300"
                      : "border-red-400/15 bg-red-400/10 text-red-300"
                  }`}
                >
                  {stat.trendUp ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {stat.trendPercent}
                </span>
              )}
            </div>
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{stat.label}</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-white">{stat.value}</p>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3 text-[11px]">
                <span className="font-semibold uppercase tracking-[0.16em] text-white/40">
                  {health.label}
                </span>
                <span className="font-bold text-white/55">{health.detail}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className={`block h-full rounded-full ${stat.barColor} transition-[width] duration-300 ease-out`}
                  style={{ width: `${health.percent}%` }}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
