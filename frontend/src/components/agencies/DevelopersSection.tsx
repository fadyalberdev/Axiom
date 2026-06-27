"use client";

import { Building2, Loader2 } from "lucide-react";
import DeveloperCard from "./DeveloperCard";
import type { AgencyBrief } from "@/types/api";

interface DevelopersSectionProps {
  agencies: AgencyBrief[];
  isLoading?: boolean;
}

export default function DevelopersSection({
  agencies,
  isLoading = false,
}: DevelopersSectionProps) {
  return (
    <section className="py-16 bg-background-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold text-white">
                Real Estate Developers
              </h2>
              {!isLoading && agencies.length > 0 && (
                <span className="text-xs font-semibold text-gray-500 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
                  {agencies.length}
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm">
              Official partners offering premium properties and new
              developments.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : agencies.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No developers found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {agencies.map((agency, i) => (
              <DeveloperCard key={agency.id} agency={agency} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
