"use client";

import { useQuery } from "@tanstack/react-query";
import SharedHousingCard from "@/components/shared-housing/SharedHousingCard";
import { recommendationsQueries } from "@/lib/queries";
import { useAuthStore } from "@/stores/authStore";

export default function ForYouSection() {
  const user = useAuthStore((state) => state.user);
  const hasPrefs = !!user?.lifestyle_preferences && Object.keys(user.lifestyle_preferences).length > 0;
  const { data } = useQuery({
    ...recommendationsQueries.list({ category: "shared_housing" }),
    enabled: hasPrefs,
  });

  if (!hasPrefs || !data?.length) return null;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Suggested for you</p>
        <h2 className="text-2xl font-black text-white">Better roommate matches</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.slice(0, 4).map((listing, index) => (
          <SharedHousingCard
            key={listing.id}
            listing={listing}
            compatibilityScore={94 - index * 3}
          />
        ))}
      </div>
    </section>
  );
}
