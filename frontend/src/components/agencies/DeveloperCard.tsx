"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, Building2, LayoutList, ArrowRight } from "lucide-react";
import type { AgencyBrief } from "@/types/api";

const CARD_ACCENTS = [
  { from: "from-[#FF5A3C]/40", via: "via-[#FF5A3C]/15", ring: "ring-[#FF5A3C]/30" },
  { from: "from-amber-500/40",  via: "via-amber-500/15",  ring: "ring-amber-500/30"  },
  { from: "from-emerald-500/40",via: "via-emerald-500/15",ring: "ring-emerald-500/30"},
  { from: "from-blue-500/40",   via: "via-blue-500/15",   ring: "ring-blue-500/30"   },
  { from: "from-violet-500/40", via: "via-violet-500/15", ring: "ring-violet-500/30" },
  { from: "from-teal-500/40",   via: "via-teal-500/15",   ring: "ring-teal-500/30"   },
];

interface DeveloperCardProps {
  agency: AgencyBrief;
  index: number;
}

export default function DeveloperCard({ agency, index }: DeveloperCardProps) {
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];

  const initials = agency.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="bg-card-dark rounded-2xl overflow-hidden border border-white/5 hover:border-white/15 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-1 group flex flex-col"
    >
      {/* ── Banner ─────────────────────────────────────────────────────── */}
      {/* overflow-hidden lives here only — logo is rendered BELOW this div */}
      <div className="relative h-32 overflow-hidden">
        {agency.banner_url ? (
          <Image
            src={agency.banner_url}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${accent.from} ${accent.via} to-transparent`}>
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
          </div>
        )}
        {/* dark fade to card body */}
        <div className="absolute inset-0 bg-gradient-to-t from-card-dark/90 via-card-dark/20 to-transparent pointer-events-none" />

        {/* Verified badge — stays inside banner, doesn't need to escape overflow */}
        {agency.verified && (
          <div className="absolute bottom-3 right-4 flex items-center gap-1 bg-primary/15 text-primary text-[10px] font-bold px-2.5 py-1.5 rounded-lg backdrop-blur-md border border-primary/25">
            <BadgeCheck className="h-3 w-3 shrink-0" />
            <span>VERIFIED</span>
          </div>
        )}
      </div>

      {/* ── Logo — outside banner overflow, overlapping via negative margin ── */}
      <div className="px-5 -mt-8 relative z-10">
        <div
          className={`w-16 h-16 rounded-2xl bg-card-dark border-2 border-white/10 flex items-center justify-center shadow-xl overflow-hidden ring-2 ${accent.ring}`}
        >
          {agency.logo_url ? (
            <Image
              src={agency.logo_url}
              alt={`${agency.name} logo`}
              width={64}
              height={64}
              className="object-contain p-1 w-full h-full"
              unoptimized
            />
          ) : (
            <span className="text-lg font-black text-white tracking-tight select-none">
              {initials}
            </span>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="px-5 pt-3 pb-5 flex flex-col flex-1">
        <div className="mb-3">
          <h3 className="text-[17px] font-bold text-white group-hover:text-primary transition-colors duration-200 leading-tight">
            {agency.name}
          </h3>
          {agency.description ? (
            <p className="text-gray-400 text-sm mt-1.5 leading-relaxed line-clamp-2">
              {agency.description}
            </p>
          ) : (
            <p className="text-gray-600 text-sm mt-1.5 italic">No description available.</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-2.5 mt-auto mb-4">
          <div className="flex-1 bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Building2 className="h-3 w-3 text-primary shrink-0" />
              <p className="text-white font-bold text-lg leading-none">
                {agency.active_projects > 0 ? agency.active_projects : "—"}
              </p>
            </div>
            <p className="text-gray-500 text-[11px] uppercase tracking-wide">Projects</p>
          </div>
          <div className="flex-1 bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
            <div className="flex items-center gap-1.5 mb-0.5">
              <LayoutList className="h-3 w-3 text-primary shrink-0" />
              <p className="text-white font-bold text-lg leading-none">
                {agency.listings_count > 0 ? agency.listings_count : "—"}
              </p>
            </div>
            <p className="text-gray-500 text-[11px] uppercase tracking-wide">Listings</p>
          </div>
        </div>

        <Link
          href={`/agencies/${agency.slug}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 border border-white/10 hover:border-primary hover:bg-primary text-gray-400 hover:text-white font-semibold rounded-xl transition-all duration-200 text-sm group/btn cursor-pointer"
        >
          <span>View Profile</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
        </Link>
      </div>
    </motion.div>
  );
}
