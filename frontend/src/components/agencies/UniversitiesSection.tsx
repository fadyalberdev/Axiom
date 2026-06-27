"use client";

import { useQuery } from "@tanstack/react-query";
import { GraduationCap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getUniversities } from "@/lib/supabase-queries";
import UniversityCard from "./UniversityCard";

export default function UniversitiesSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["universities", "preview"],
    queryFn: () => getUniversities(undefined, 4),
  });

  const universities = data?.universities ?? [];

  return (
    <section className="py-16 bg-[#161616] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" /> Partner Universities
            </h2>
            <p className="text-gray-400 text-sm">
              Discover verified student housing and campus-adjacent rentals.
            </p>
          </div>
          <Link
            href="/universities"
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : universities.length === 0 ? (
          <p className="text-gray-500 text-sm">No partner universities yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {universities.map((university, i) => (
              <UniversityCard key={university.id} university={university} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
