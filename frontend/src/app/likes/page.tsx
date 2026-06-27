"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, MapPin, ArrowUpRight, Loader2, ChevronLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { favoritesQueries, favoriteMutation } from "@/lib/queries";
import { getLikedListings } from "@/lib/supabase-queries";
import { formatEGP, getListingPriceSuffix } from "@/lib/utils";

export default function LikesPage() {
  const queryClient = useQueryClient();

  const { data: likedIds = new Set<string>(), isLoading: idsLoading } = useQuery(
    favoritesQueries.ids()
  );

  const toggleMutation = useMutation({
    ...favoriteMutation,
    onMutate: async (listingId: string) => {
      await queryClient.cancelQueries({ queryKey: ["favorites", "ids"] });
      const prev = queryClient.getQueryData<Set<string>>(["favorites", "ids"]);
      queryClient.setQueryData(["favorites", "ids"], (old: Set<string> | undefined) => {
        const next = new Set(old ?? []);
        if (next.has(listingId)) next.delete(listingId);
        else next.add(listingId);
        return next;
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(["favorites", "ids"], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "me"] });
    },
  });

  const orderedIds = Array.from(likedIds).reverse();

  const { data: raw = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["liked-listings-all", orderedIds],
    queryFn: () => getLikedListings(orderedIds),
    enabled: orderedIds.length > 0,
    staleTime: 0,
  });

  const isLoading = idsLoading || listingsLoading;

  const listings = orderedIds
    .map((id) => raw.find((l) => String(l.id) === id))
    .filter(Boolean) as typeof raw;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            Saved Properties
            <span className="bg-white/10 text-gray-400 text-sm px-2.5 py-0.5 rounded-full font-medium">
              {likedIds.size}
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">All your saved listings</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && likedIds.size === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Heart className="h-12 w-12 text-gray-600 mb-4" />
          <p className="text-gray-400 font-semibold text-lg">No saved properties yet</p>
          <p className="text-gray-600 text-sm mt-1 mb-6">
            Hit the heart on any listing to save it here.
          </p>
          <Link
            href="/find-homes"
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Browse Listings
          </Link>
        </div>
      )}

      {!isLoading && listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                <div className="relative h-64 overflow-hidden">
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
                    aria-label="Remove from saved"
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
