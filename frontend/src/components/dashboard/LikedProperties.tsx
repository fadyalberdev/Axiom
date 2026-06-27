"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, MapPin, ArrowUpRight, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { favoritesQueries, favoriteMutation } from "@/lib/queries";
import { getLikedListings } from "@/lib/supabase-queries";
import { formatEGP, getListingPriceSuffix } from "@/lib/utils";

const DASHBOARD_LIMIT = 2;

export default function LikedProperties() {
  const queryClient = useQueryClient();

  const { data: likedIds = new Set<string>(), isLoading: idsLoading } = useQuery(
    favoritesQueries.ids()
  );

  const toggleMutation = useMutation({
    ...favoriteMutation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const previewIds = Array.from(likedIds).slice(-DASHBOARD_LIMIT).reverse();

  const { data: raw = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["liked-listings-preview", previewIds],
    queryFn: () => getLikedListings(previewIds),
    enabled: previewIds.length > 0,
    staleTime: 0,
  });

  const isLoading = idsLoading || listingsLoading;

  // Restore newest-first order (Supabase .in() ignores array order)
  const listings = previewIds
    .map((id) => raw.find((l) => String(l.id) === id))
    .filter(Boolean) as typeof raw;

  const hasMore = likedIds.size > DASHBOARD_LIMIT;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          Saved Properties
          <span className="bg-white/10 text-gray-400 text-sm px-2.5 py-0.5 rounded-full font-medium">
            {likedIds.size}
          </span>
        </h2>
        {hasMore && (
          <Link
            href="/likes"
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            View All Likes <ArrowUpRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && likedIds.size === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Heart className="h-10 w-10 text-gray-600 mb-3" />
          <p className="text-gray-400 font-medium">No liked properties yet</p>
          <p className="text-gray-600 text-sm mt-1">
            Save a listing by clicking the heart icon.
          </p>
        </div>
      )}

      {!isLoading && listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {listings.map((l) => {
            const image = l.images?.[0] ?? "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800";
            const specs: string[] = [];
            if (l.bedrooms != null) specs.push(`${l.bedrooms} Bed${l.bedrooms !== 1 ? "s" : ""}`);
            if (l.bathrooms != null) specs.push(`${l.bathrooms} Bath${l.bathrooms !== 1 ? "s" : ""}`);
            if (l.size_sqm != null) specs.push(`${l.size_sqm} m²`);

            const priceSuffix = getListingPriceSuffix(l.category, l.price_period);

            return (
              <div
                key={l.id}
                className="bg-card-dark rounded-2xl overflow-hidden border border-white/5 group hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-black/50"
              >
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={image}
                    alt={l.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate(String(l.id))}
                    className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/40 hover:bg-white text-primary hover:text-red-500 backdrop-blur-sm flex items-center justify-center transition-colors"
                    aria-label="Remove from favourites"
                  >
                    <Heart className="h-5 w-5 fill-current" />
                  </button>
                  {specs.length > 0 && (
                    <div className="absolute bottom-3 left-3 flex gap-2">
                      {specs.map((s) => (
                        <span key={s} className="bg-black/60 backdrop-blur-md text-white text-xs font-medium px-2 py-1 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 pr-2">
                      <h3 className="text-white font-bold text-xl truncate">{l.title}</h3>
                      <p className="text-gray-400 text-sm flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" /> {l.location}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-primary font-bold text-xl">{formatEGP(l.price)}</span>
                      {priceSuffix && (
                        <span className="block text-gray-500 text-xs">{priceSuffix}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/5 flex justify-end">
                    <Link
                      href={`/property/${l.id}`}
                      className="text-sm font-medium text-white hover:text-primary transition-colors flex items-center gap-1"
                    >
                      View Details <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
