import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProjectHero from "@/components/project-details/ProjectHero";
import ProjectInfo from "@/components/project-details/ProjectInfo";
import ProjectGallery from "@/components/project-details/ProjectGallery";
import ResidencesGrid from "@/components/project-details/ResidencesGrid";
import ProjectSidebar from "@/components/project-details/ProjectSidebar";
import { getProject } from "@/lib/supabase-queries";
import type { ApiProjectDetail } from "@/types/api";
import type { ProjectDetail, Residence } from "@/types";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200";

function mapProject(
  data: ApiProjectDetail,
  listings: Record<string, unknown>[],
): ProjectDetail {
  const residences: Residence[] = listings.map((l) => ({
    id: l.id as string,
    title: l.title as string,
    subtitle: l.location as string,
    image: (Array.isArray(l.images) && (l.images as string[])[0]) || FALLBACK_IMAGE,
    beds: l.bedrooms != null ? `${l.bedrooms}` : "—",
    baths: l.bathrooms != null ? `${l.bathrooms}` : "—",
    size: l.size_sqm != null ? `${l.size_sqm} m²` : "—",
    price: `EGP ${(l.price as number).toLocaleString()}`,
  }));

  return {
    id: data.id,
    title: data.title,
    subtitle: data.subtitle ?? "",
    image: data.image_url ?? FALLBACK_IMAGE,
    developerName: data.agency_name ?? "Agency",
    developerVerified: data.agency_verified,
    description: data.description ?? "",
    completion: `${data.completion_pct}%`,
    unitsTotal: `${data.units_total ?? 0}`,
    startingPrice: data.starting_price
      ? `EGP ${data.starting_price.toLocaleString()}`
      : "Contact for price",
    status: data.status,
    keyFeatures: data.key_features.map((f) => ({ icon: "CheckCircle", label: f })),
    gallery: data.gallery_images ?? [],
    brochureUrl: data.brochure_url ?? null,
    residences,
    salesAgent: { name: "Sales Team", role: "Sales Agent", avatar: "" },
    residenceOptions: residences.map((r) => r.title),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { data } = await getProject(id).catch(() => ({ data: null, listings: [] }));
  const project = data ? mapProject(data, []) : null;
  return {
    title: `${project?.title ?? "Project"} — Axiom`,
    description: project?.subtitle ?? "",
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, listings } = await getProject(id);
  const project = data ? mapProject(data, listings as Record<string, unknown>[]) : null;
  if (!project) notFound();

  return <ProjectPage project={project} />;
}

function ProjectPage({ project }: { project: ProjectDetail }) {
  return (
    <>
      <ProjectHero project={project} />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          <div className="flex-1 space-y-12">
            <ProjectInfo project={project} />
            <ProjectGallery images={project.gallery} title={project.title} />
            <ResidencesGrid project={project} />
          </div>
          <aside className="w-full lg:w-80 shrink-0">
            <ProjectSidebar project={project} />
          </aside>
        </div>
      </div>
    </>
  );
}
