"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, BadgeCheck, Users, Expand } from "lucide-react";
import type { SharedHousingDetail } from "@/types";
import ImageLightbox from "@/components/ui/ImageLightbox";

interface SharedHousingHeroProps {
  housing: SharedHousingDetail;
}

export default function SharedHousingHero({ housing }: SharedHousingHeroProps) {
  const images = housing.images?.length ? housing.images : housing.image ? [housing.image] : [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  function prev() {
    setCurrentIdx((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    setCurrentIdx((i) => (i + 1) % images.length);
  }

  const mainImage = images[currentIdx] ?? housing.image;

  return (
    <>
      <div className="relative w-full h-[60vh] overflow-hidden group">
        {mainImage && (
          <Image
            src={mainImage}
            alt={housing.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            priority
            sizes="100vw"
          />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background-dark/40 to-background-dark/95 pointer-events-none" />

        {/* Click to open lightbox */}
        <button
          onClick={() => setLightboxOpen(true)}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="View all photos"
        >
          <Expand className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 z-10">
          <div className="max-w-[1600px] mx-auto">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-2">
                {housing.verified && (
                  <span className="bg-white/10 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full uppercase tracking-wider font-semibold border border-white/20 flex items-center gap-1">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
                <span className="bg-primary/90 text-white text-xs px-3 py-1 rounded-full uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Shared Housing
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                {housing.title}
              </h1>
              <div className="flex items-center text-gray-300 gap-2 mt-1">
                <span className="text-primary text-lg">&#9679;</span>
                <span className="text-lg">{housing.location}</span>
              </div>

              {/* Image counter */}
              {images.length > 1 && (
                <span className="text-xs text-white/60 mt-1">
                  {currentIdx + 1} / {images.length} photos · click to view all
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute top-1/2 left-6 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={next}
              className="absolute top-1/2 right-6 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      <ImageLightbox
        images={images}
        currentIndex={currentIdx}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setCurrentIdx}
      />
    </>
  );
}
