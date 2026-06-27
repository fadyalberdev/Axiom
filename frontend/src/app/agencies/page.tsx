"use client";

import { useQuery } from "@tanstack/react-query";
import AgenciesHero from "@/components/agencies/AgenciesHero";
import DevelopersSection from "@/components/agencies/DevelopersSection";
import UniversitiesSection from "@/components/agencies/UniversitiesSection";
import { getAgencies } from "@/lib/supabase-queries";

export default function AgenciesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["agencies"],
    queryFn: () => getAgencies(),
  });

  return (
    <>
      <AgenciesHero />
      <DevelopersSection agencies={data?.agencies ?? []} isLoading={isLoading} />
      <UniversitiesSection />
    </>
  );
}
