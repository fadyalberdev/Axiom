"use client";

import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Home, MapPin, Ruler } from "lucide-react";
import {
  formatEGP,
  formatListingType,
  getListingCategoryBadge,
  isListingNewWithinWeek,
} from "@/lib/utils";
import type { ListingBrief } from "@/types/api";

type Props = {
  listing: ListingBrief;
  compatibilityScore?: number | null;
};

export default function SharedHousingCard({ listing }: Props) {
  const category = getListingCategoryBadge(listing.category);
  const isNew = isListingNewWithinWeek(listing.created_at);
  const listingType = formatListingType(listing.room_type ?? listing.property_type);
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
    <Link
      href={`/property/${listing.id}`}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-card-dark shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-black/30">
        <Image
          src={listing.images[0] || "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900"}
          alt={listing.title}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
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
            <span className="block text-[10px] font-medium text-gray-500">/month</span>
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
  );
}
