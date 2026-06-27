"use client";

import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Heart, Home, MapPin, Ruler } from "lucide-react";
import type { Listing } from "@/types";
import {
  formatEGP,
  formatListingType,
  getListingCategoryBadge,
  isListingNewWithinWeek,
} from "@/lib/utils";

interface SearchListingRowProps {
  listing: Listing;
}

export default function SearchListingRow({ listing }: SearchListingRowProps) {
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
    <Link
      href={`/property/${listing.id}`}
      className="group flex cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-card-dark shadow-md transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative w-44 shrink-0 overflow-hidden bg-white/5">
        <Image
          src={listing.image}
          alt={listing.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes="176px"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20" />
        <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5">
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

      <div className="flex flex-1 items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-black leading-snug text-white">
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
          {specs.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-medium text-gray-400">
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

        <div className="flex shrink-0 flex-col items-end gap-3">
          <div className="text-right">
            <span className="text-lg font-black tabular-nums text-primary">
              {formatEGP(listing.price)}
            </span>
            {!isForSale && (
              <span className="block text-[10px] font-medium text-gray-500">/month</span>
            )}
          </div>
          <button
            type="button"
            onClick={(event) => event.preventDefault()}
            aria-label={listing.liked ? "Remove from favourites" : "Add to favourites"}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white transition-colors duration-150 hover:bg-white hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Heart
              className="h-3.5 w-3.5"
              fill={listing.liked ? "currentColor" : "none"}
            />
          </button>
        </div>
      </div>
    </Link>
  );
}
