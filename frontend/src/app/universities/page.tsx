"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Search } from "lucide-react";
import { getUniversities } from "@/lib/supabase-queries";
import UniversityCard from "@/components/agencies/UniversityCard";

export default function UniversitiesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 300);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["universities", debouncedSearch],
    queryFn: () => getUniversities(debouncedSearch || undefined, 24),
  });

  const universities = data?.universities ?? [];

  return (
    <div className="min-h-screen bg-[#0e0e0e]">
      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,107,0,0.08),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span className="text-primary text-xs font-semibold uppercase tracking-widest">Partner Universities</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
            Find Student Housing Near Campus
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-10">
            Browse verified housing options partnered with universities across Egypt.
          </p>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search universities…"
              className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition"
            />
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-72 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : universities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <GraduationCap className="h-12 w-12 text-gray-700 mb-4" />
            <p className="text-gray-400 font-medium">No universities found</p>
            {debouncedSearch && (
              <p className="text-gray-600 text-sm mt-1">
                Try a different search term
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-6">
              {universities.length} partner {universities.length === 1 ? "university" : "universities"}
              {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {universities.map((university, i) => (
                <UniversityCard key={university.id} university={university} index={i} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
