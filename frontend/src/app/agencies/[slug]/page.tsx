import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AgencyHero from "@/components/agency-details/AgencyHero";
import AgencySidebar from "@/components/agency-details/AgencySidebar";
import FeaturedProjects from "@/components/agency-details/FeaturedProjects";
import TopListings from "@/components/agency-details/TopListings";
import { getAgency } from "@/lib/supabase-queries";
import type { ProjectBrief } from "@/types/api";
import type { AgencyDetail, AgencyProject } from "@/types";

function mapProject(p: ProjectBrief): AgencyProject {
  const statusColor =
    p.status === "completed" ? "text-green-400" : "text-yellow-400";
  return {
    id: p.id,
    title: p.title,
    location: "Egypt",
    image: p.image_url ?? "",
    price: p.starting_price
      ? `EGP ${p.starting_price.toLocaleString()}`
      : "Contact for price",
    priceLabel: "Starting from",
    beds: "Various",
    area: "N/A",
    status: p.status,
    statusColor,
    progressPercent: p.completion_pct,
    progressColor: "bg-primary",
    progressLabel: `${p.completion_pct}% Complete`,
    completionLabel: `${p.completion_pct}%`,
    cta: "Learn More",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { agency } = await getAgency(slug);
  if (!agency) return { title: "Agency — Axiom" };
  return {
    title: `${agency.name} — Axiom`,
    description: agency.description ?? `Explore properties from ${agency.name} on Axiom.`,
  };
}

export default async function AgencyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { agency, projects, listings } = await getAgency(slug);

  if (!agency) notFound();

  const verifiedPts = agency.verified ? 40 : 0;
  const projectPts = Math.min(agency.active_projects * 5, 30);
  const listingPts = Math.min(agency.listings_count * 2, 30);
  const trustBreakdown = `${verifiedPts} (verified) + ${projectPts} (projects) + ${listingPts} (listings)`;

  const foundedYear = agency.founded_year;
  const devHistory = foundedYear
    ? `${new Date().getFullYear() - foundedYear} Years`
    : agency.created_at
    ? `${new Date().getFullYear() - new Date(agency.created_at).getFullYear()} Years`
    : "N/A";

  const detail: AgencyDetail = {
    slug: agency.slug,
    name: agency.name,
    logoText: agency.name.slice(0, 2).toUpperCase(),
    logo_url: agency.logo_url ?? null,
    badge: agency.verified ? "Verified Developer" : "Developer",
    location: agency.city ? `${agency.city}, Egypt` : "Egypt",
    bannerImage: agency.banner_url ?? "",
    description: agency.description ?? "",
    trustScore: `${agency.trust_score}`,
    trustBreakdown,
    projectsForSale: `${agency.active_projects}`,
    developmentHistory: devHistory,
    website: agency.website ?? null,
    phone: agency.phone ?? null,
    email: agency.email ?? null,
    awards: [],
    featuredProjects: projects.map(mapProject),
    topListings: listings.slice(0, 3).map((l) => {
      const listing = l as Record<string, unknown>;
      const images = (listing.images as string[] | null) ?? [];
      return {
        id: listing.id as string,
        title: listing.title as string,
        location: listing.location as string,
        image: images[0] ?? "",
        price: `EGP ${(listing.price as number).toLocaleString()}`,
        priceLabel: `/${(listing.price_period as string) ?? "mo"}`,
        beds: listing.bedrooms != null ? `${listing.bedrooms}` : "N/A",
        area: listing.size_sqm ? `${listing.size_sqm} m²` : "N/A",
        status: listing.status as string,
        statusColor: "text-green-400",
        progressPercent: 100,
        progressColor: "bg-primary",
        progressLabel: "Active",
        completionLabel: "Active",
        cta: "View Listing",
      };
    }),
    totalListings: listings.length,
    totalCities: 1,
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-20">
      <AgencyHero agency={detail} />
      <div className="px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-[30%]">
            <AgencySidebar agency={detail} />
          </div>
          <div className="lg:w-[70%] space-y-12">
            <FeaturedProjects projects={detail.featuredProjects} />
            <TopListings
              listings={detail.topListings}
              totalListings={detail.totalListings}
              totalCities={detail.totalCities}
              agencyId={agency.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
