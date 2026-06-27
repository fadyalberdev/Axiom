"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import ForYouSection from "@/components/shared-housing/ForYouSection";
import SharedHousingCard from "@/components/shared-housing/SharedHousingCard";
import SharedHousingFilters from "@/components/shared-housing/SharedHousingFilters";
import { listingsQueries, type ListingsParams } from "@/lib/queries";

export default function SharedHousingPage() {
  const searchParams = useSearchParams();
  const params = useMemo<ListingsParams>(() => {
    const next: ListingsParams = {
      category: "shared_housing",
      page: 1,
      per_page: 24,
    };
    const gender = searchParams.get("gender_preference");
    const roomType = searchParams.get("room_type");
    if (gender === "male" || gender === "female") next.gender_preference = gender;
    if (roomType === "private" || roomType === "ensuite" || roomType === "shared") {
      next.room_type = roomType;
    }
    if (searchParams.get("utilities_included") === "true") next.utilities_included = true;
    if (searchParams.get("has_spots") === "true") next.has_spots = true;
    if (searchParams.get("available_before")) {
      next.available_before = searchParams.get("available_before") ?? undefined;
    }
    return next;
  }, [searchParams]);

  const { data, isLoading, isError } = useQuery(listingsQueries.list(params));

  return (
    <main className="mx-auto max-w-[1600px] space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-3 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Shared housing</p>
          <h1 className="mt-2 text-3xl font-black text-white md:text-5xl">Find a room that fits your life</h1>
        </div>
        <p className="max-w-xl text-sm leading-6 text-gray-400">
          Filter by house rules, occupied spots, bills, and room style.
        </p>
      </section>

      <SharedHousingFilters />
      <ForYouSection />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">All shared homes</h2>
          <span className="text-sm text-gray-400">{data?.total ?? 0} results</span>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
            Shared housing listings could not be loaded.
          </div>
        )}

        {!isLoading && !isError && data?.listings.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-card-dark p-10 text-center text-gray-300">
            No shared homes match these filters yet.
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {data?.listings.map((listing) => (
            <SharedHousingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>
    </main>
  );
}
