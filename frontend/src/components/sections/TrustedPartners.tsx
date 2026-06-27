"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const FALLBACK = [
  "SODIC",
  "Emaar Misr",
  "Palm Hills",
  "TMG",
  "Hyde Park",
  "Sixth of October",
];

export default function TrustedPartners() {
  const { data: agenciesData } = useQuery({
    queryKey: ["agencies", "partners"],
    queryFn: async () => {
      const result = await api.get<{ agencies: Array<{ id: string; name: string }> }>(
        "/api/agencies?limit=20"
      );
      return result.agencies ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const partnerNames =
    agenciesData && agenciesData.length > 0
      ? agenciesData.map((a) => a.name)
      : FALLBACK;

  return (
    <section className="py-12 bg-[#101010]">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <p className="text-primary text-[10px] font-bold tracking-widest uppercase mb-8">
          Trusted Partners
        </p>
        <div className="overflow-hidden w-full">
          <div className="flex gap-6 animate-marquee w-max">
            {[...partnerNames, ...partnerNames].map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex-shrink-0 flex items-center justify-center h-12 px-5 rounded-xl border border-white/10 bg-white/[0.03] min-w-[130px]"
              >
                <span className="text-white/60 font-semibold text-sm whitespace-nowrap">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
