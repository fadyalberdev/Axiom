import dynamic from "next/dynamic";
import HomeHero from "@/components/sections/HomeHero";

const FeaturesSection = dynamic(() => import("@/components/sections/FeaturesSection"));
const VibeMatchesSection = dynamic(() => import("@/components/sections/VibeMatchesSection"));
const HowItWorksSection = dynamic(() => import("@/components/sections/HowItWorksSection"));
const NeighborhoodGuides = dynamic(() => import("@/components/sections/NeighborhoodGuides"));
const TestimonialsSection = dynamic(() => import("@/components/sections/TestimonialsSection"));
const TrustedPartners = dynamic(() => import("@/components/sections/TrustedPartners"));
const CTASection = dynamic(() => import("@/components/sections/CTASection"));
const RecommendationsSectionClient = dynamic(() => import("@/components/sections/RecommendationsSectionClient"));

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <FeaturesSection />
      <RecommendationsSectionClient />
      <VibeMatchesSection />
      <HowItWorksSection />
      <NeighborhoodGuides />
      {/* <TestimonialsSection /> */}
      <TrustedPartners />
      <CTASection />
    </>
  );
}
