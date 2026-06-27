"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import ListingCard from "@/components/cards/ListingCard";
import { listingsQueries } from "@/lib/queries";
import type { Listing } from "@/types";
import type { ListingBrief } from "@/types/api";

function mapToListing(l: ListingBrief): Listing {
  const tags: string[] = [];
  if (l.bedrooms != null) tags.push(`${l.bedrooms} Bed${l.bedrooms !== 1 ? "s" : ""}`);
  if (l.bathrooms != null) tags.push(`${l.bathrooms} Bath${l.bathrooms !== 1 ? "s" : ""}`);
  if (l.size_sqm != null) tags.push(`${l.size_sqm} m²`);
  if (l.property_type) tags.push(l.property_type);

  return {
    id: l.id,
    title: l.title,
    location: l.location,
    price: l.price,
    image: l.images[0] ?? "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
    matchPercent: 0,
    verified: l.verified,
    filledSpots: 0,
    totalSpots: 1,
    tags,
    avatars: [],
    liked: false,
    category: l.category,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    size_sqm: l.size_sqm,
    property_type: l.property_type,
    is_new: l.is_new,
    created_at: l.created_at,
  };
}

export default function VibeMatchesSection() {
  const { data, isLoading, isError } = useQuery(
    listingsQueries.list({ sort_by: "most_viewed", per_page: 3 })
  );

  const listings: Listing[] = (data?.listings ?? []).map(mapToListing);

  return (
    <section className="py-20 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Top Listings
            </h2>
            <p className="text-gray-400 text-sm">
              Most viewed properties right now
            </p>
          </div>
          <Link
            href="/find-homes"
            className="text-primary text-sm font-semibold hover:text-primary-hover flex items-center gap-1 group"
          >
            View all listings{" "}
            <span className="group-hover:translate-x-1 transition-transform">
              &rarr;
            </span>
          </Link>
        </div>

        {isError && (
          <p className="text-gray-500 text-sm text-center py-8">
            Could not load listings.
          </p>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-card-dark animate-pulse border border-white/5"
              />
            ))}
          </div>
        )}

        {!isLoading && !isError && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {listings.map((listing, i) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <ListingCard listing={listing} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
