"use client";

import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import type { AgencyProject } from "@/types";
import ProjectCard from "./ProjectCard";

interface TopListingsProps {
  listings: AgencyProject[];
  totalListings: number;
  totalCities: number;
  agencyId?: string;
}

export default function TopListings({
  listings,
  totalListings,
  agencyId,
}: TopListingsProps) {
  const allListingsHref = agencyId
    ? `/find-homes?agency_id=${agencyId}`
    : "/find-homes";
  return (
    <div className="space-y-8 pt-8 border-t border-white/5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Most Selling Real Estate Listings
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            High demand properties from this developer
          </p>
        </div>
        <Link
          href={allListingsHref}
          className="text-primary hover:text-white text-sm font-medium flex items-center gap-1 transition-colors shrink-0"
        >
          View all listings <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="text-gray-500 text-sm">No listings available.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {listings.map((listing, i) => (
            <ProjectCard key={listing.id} project={listing} index={i} />
          ))}

          {/* View All Sale Listings CTA card */}
          <div className="bg-card-dark rounded-2xl border border-white/5 overflow-hidden flex flex-col items-center justify-center p-10 text-center min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">
              View All Sale Listings
            </h3>
            <p className="text-gray-400 text-sm mb-6 max-w-[220px] leading-relaxed">
              Browse our complete portfolio of {totalListings} ownership
              opportunities.
            </p>
            <Link
              href={allListingsHref}
              className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all text-sm cursor-pointer"
            >
              Load More Properties
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
