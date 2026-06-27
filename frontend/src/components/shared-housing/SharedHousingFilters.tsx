"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

const ROOM_TYPES = ["private", "ensuite", "shared"] as const;

export default function SharedHousingFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/shared-housing?${params.toString()}`);
  }

  const active = (key: string, value: string) => searchParams.get(key) === value;

  return (
    <div className="rounded-2xl border border-white/10 bg-card-dark/80 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        Filters
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setParam("gender_preference", active("gender_preference", "female") ? null : "female")}
          className={chipClass(active("gender_preference", "female"))}
        >
          Female only
        </button>
        <button
          type="button"
          onClick={() => setParam("gender_preference", active("gender_preference", "male") ? null : "male")}
          className={chipClass(active("gender_preference", "male"))}
        >
          Male only
        </button>
        <button
          type="button"
          onClick={() => setParam("utilities_included", searchParams.get("utilities_included") ? null : "true")}
          className={chipClass(searchParams.get("utilities_included") === "true")}
        >
          Bills included
        </button>
        <button
          type="button"
          onClick={() => setParam("has_spots", searchParams.get("has_spots") ? null : "true")}
          className={chipClass(searchParams.get("has_spots") === "true")}
        >
          Has spots
        </button>
        {ROOM_TYPES.map((roomType) => (
          <button
            key={roomType}
            type="button"
            onClick={() => setParam("room_type", active("room_type", roomType) ? null : roomType)}
            className={chipClass(active("room_type", roomType))}
          >
            {roomType}
          </button>
        ))}
        <input
          type="date"
          value={searchParams.get("available_before") ?? ""}
          onChange={(event) => setParam("available_before", event.target.value || null)}
          className="h-9 rounded-full border border-white/10 bg-input-dark px-3 text-xs text-gray-200 outline-none focus:border-primary"
        />
      </div>
    </div>
  );
}

function chipClass(active: boolean) {
  return active
    ? "h-9 rounded-full border border-primary bg-primary px-4 text-xs font-bold text-white"
    : "h-9 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-bold text-gray-300 transition hover:border-white/30";
}
