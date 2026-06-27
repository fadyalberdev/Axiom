"use client";

import dynamic from "next/dynamic";

// Loaded client-side only — reads Zustand auth store, uses localStorage
const RecommendationsSection = dynamic(
  () => import("@/components/sections/RecommendationsSection"),
  { ssr: false }
);

export default function RecommendationsSectionClient() {
  return <RecommendationsSection />;
}
