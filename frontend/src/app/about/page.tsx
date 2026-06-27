import type { Metadata } from "next";
import AboutHero from "@/components/about/AboutHero";
import MissionAndValues from "@/components/about/MissionAndValues";
import TeamSection from "@/components/about/TeamSection";

export const metadata: Metadata = {
  title: "About Us — Axiom",
  description:
    "Learn about Axiom's mission to redefine real estate through AI-powered compatibility matching.",
};

export default function AboutPage() {
  return (
    <div className="pt-8 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <AboutHero />
        <MissionAndValues />
        <TeamSection />
      </div>
    </div>
  );
}
