import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Home, BedDouble, Maximize2, ArrowRight } from "lucide-react";
import { getUniversity } from "@/lib/supabase-queries";
import UniversityHero from "@/components/universities/UniversityHero";
import UniversitySidebar from "@/components/universities/UniversitySidebar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { university } = await getUniversity(slug);
  if (!university) return { title: "University — Axiom" };
  return {
    title: `${university.name} — Axiom`,
    description:
      university.description ??
      `Find student housing near ${university.name} on Axiom.`,
  };
}

export default async function UniversityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { university, listings } = await getUniversity(slug);

  if (!university) notFound();

  return (
    <div className="max-w-[1600px] mx-auto pb-20">
      <UniversityHero university={university} />

      <div className="px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-[30%]">
            <UniversitySidebar university={university} />
          </div>

          <div className="lg:w-[70%] space-y-8">
            {/* Listings section */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Student Housing Near Campus
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Verified listings close to {university.name}
                  </p>
                </div>
                <Link
                  href={`/find-homes`}
                  className="text-primary hover:text-white text-sm font-medium flex items-center gap-1 transition-colors shrink-0"
                >
                  Browse all <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {listings.length === 0 ? (
                <div className="bg-card-dark rounded-2xl border border-white/5 flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <Home className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">
                    No listings yet
                  </h3>
                  <p className="text-gray-400 text-sm max-w-[260px] leading-relaxed">
                    No active listings are linked to this university yet. Check back soon.
                  </p>
                  <Link
                    href="/find-homes"
                    className="mt-6 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all text-sm"
                  >
                    Browse All Homes
                  </Link>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {listings.map((l) => {
                    const images = (l.images as string[] | null) ?? [];
                    const price = l.price as number;
                    const period = (l.price_period as string) ?? "mo";
                    return (
                      <Link
                        key={l.id as string}
                        href={`/property/${l.id as string}`}
                        className="bg-card-dark rounded-2xl border border-white/5 hover:border-primary/30 overflow-hidden transition-all duration-300 group block"
                      >
                        <div className="relative h-48 bg-gray-800">
                          {images[0] ? (
                            <Image
                              src={images[0]}
                              alt={l.title as string}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                              sizes="(max-width: 768px) 100vw, 50vw"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent flex items-center justify-center">
                              <Home className="h-10 w-10 text-primary/40" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-3 left-3">
                            <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                              EGP {price.toLocaleString()}/{period}
                            </span>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-primary transition-colors line-clamp-1">
                            {l.title as string}
                          </h3>
                          <p className="text-gray-400 text-xs mb-3 line-clamp-1">
                            {l.location as string}
                          </p>
                          <div className="flex items-center gap-4 text-gray-400 text-xs">
                            {(l.bedrooms as number | null) != null && (
                              <span className="flex items-center gap-1">
                                <BedDouble className="h-3.5 w-3.5" />
                                {l.bedrooms as number} bed
                              </span>
                            )}
                            {(l.size_sqm as number | null) != null && (
                              <span className="flex items-center gap-1">
                                <Maximize2 className="h-3.5 w-3.5" />
                                {l.size_sqm as number} m²
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
