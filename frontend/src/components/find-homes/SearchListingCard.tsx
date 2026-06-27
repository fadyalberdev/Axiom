"use client";

import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Home, MapPin, Ruler } from "lucide-react";
import { motion } from "framer-motion";
import type { Listing } from "@/types";
import {
  formatEGP,
  formatListingType,
  getListingCategoryBadge,
  isListingNewWithinWeek,
} from "@/lib/utils";
import LikeButton from "@/components/ui/LikeButton";

interface SearchListingCardProps {
  listing: Listing;
}

export default function SearchListingCard({ listing }: SearchListingCardProps) {
  const isForSale = listing.category === "for_sale";
  const category = getListingCategoryBadge(listing.category);
  const isNew = isListingNewWithinWeek(listing.created_at);
  const listingType = formatListingType(listing.property_type);
  const specs = [
    listing.bedrooms != null
      ? { icon: BedDouble, label: `${listing.bedrooms} Bed${listing.bedrooms === 1 ? "" : "s"}` }
      : null,
    listing.bathrooms != null
      ? { icon: Bath, label: `${listing.bathrooms} Bath${listing.bathrooms === 1 ? "" : "s"}` }
      : null,
    listing.size_sqm != null ? { icon: Ruler, label: `${listing.size_sqm} m²` } : null,
  ].filter(Boolean);

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative will-change-transform"
    >
      {/* Like button lives OUTSIDE <Link> so mobile taps never bubble to navigation */}
      <LikeButton id={String(listing.id)} className="absolute right-3 top-3 z-10" />

      <Link
        href={`/property/${listing.id}`}
        className="group block cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-card-dark shadow-lg transition-all duration-300 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="relative h-56 overflow-hidden bg-white/5">
          <Image
            src={listing.image}
            alt={listing.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/15" />

          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
            {isNew && (
              <span className="rounded-md border border-primary/30 bg-primary px-2.5 py-1 text-[10px] font-black tracking-wide text-white shadow-lg shadow-black/20">
                NEW
              </span>
            )}
            {category && (
              <span className={`rounded-md border px-2.5 py-1 text-[10px] font-black tracking-wide shadow-lg shadow-black/15 ${category.className}`}>
                {category.label}
              </span>
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-[15px] font-black leading-snug text-white">
                {listing.title}
              </h3>
              <p className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{listing.location}</span>
              </p>
              <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-gray-300">
                <Home className="h-3 w-3 text-primary" />
                <span className="truncate">{listingType}</span>
              </span>
            </div>

            <div className="shrink-0 text-right">
              <span className="text-lg font-black tabular-nums text-primary">
                {formatEGP(listing.price)}
              </span>
              {!isForSale && (
                <span className="block text-[10px] font-medium text-gray-500">/month</span>
              )}
            </div>
          </div>
          {specs.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/5 pt-3 text-[11px] font-medium text-gray-400">
              {specs.map((spec) => {
                const Icon = spec!.icon;
                return (
                  <span key={spec!.label} className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-gray-500" />
                    {spec!.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
