"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Grid2x2, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PropertyDetail } from "@/types";
import ImageLightbox from "@/components/ui/ImageLightbox";
import LikeButton from "@/components/ui/LikeButton";

interface PropertyHeroProps {
  property: PropertyDetail;
}

export default function PropertyHero({ property }: PropertyHeroProps) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const prev = () =>
    setCurrent((c) => (c === 0 ? property.images.length - 1 : c - 1));
  const next = () =>
    setCurrent((c) => (c === property.images.length - 1 ? 0 : c + 1));

  const hasMultiple = property.images.length > 1;
  const gridImages = property.images.slice(0, 5);

  return (
    <>
      {/* ── Desktop: Airbnb-style grid gallery ── */}
      <div className="hidden md:block px-4 sm:px-6 lg:px-8 pt-6">
        <div className="relative rounded-2xl overflow-hidden">
          {gridImages.length === 1 ? (
            /* Single image — full width */
            <button
              onClick={() => setLightboxOpen(true)}
              className="relative w-full h-[60vh] block cursor-zoom-in"
            >
              <Image
                src={gridImages[0]}
                alt={property.title}
                fill
                className="object-cover"
                priority
                sizes="100vw"
              />
            </button>
          ) : (
            /* 2-column grid: 1 large + 2×2 thumbnails */
            <div className="grid grid-cols-2 gap-2 h-[60vh]">
              {/* Main large image */}
              <button
                onClick={() => { setCurrent(0); setLightboxOpen(true); }}
                className="relative h-full cursor-zoom-in"
              >
                <Image
                  src={gridImages[0]}
                  alt={`${property.title} – main`}
                  fill
                  className="object-cover hover:brightness-90 transition-[filter] duration-300"
                  priority
                  sizes="50vw"
                />
              </button>

              {/* Right 2×2 grid */}
              <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full">
                {gridImages.slice(1, 5).map((src, i) => (
                  <button
                    key={i}
                    onClick={() => { setCurrent(i + 1); setLightboxOpen(true); }}
                    className="relative cursor-zoom-in overflow-hidden"
                  >
                    <Image
                      src={src}
                      alt={`${property.title} – ${i + 2}`}
                      fill
                      className="object-cover hover:brightness-90 transition-[filter] duration-300"
                      sizes="25vw"
                    />
                    {/* Overlay on last cell if more photos exist */}
                    {i === 3 && property.images.length > 5 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-semibold text-lg">
                          +{property.images.length - 5} more
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Show all photos button */}
          <button
            onClick={() => { setCurrent(0); setLightboxOpen(true); }}
            className="absolute bottom-4 right-4 flex items-center gap-2 bg-white text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-gray-100 transition-colors"
          >
            <Grid2x2 className="h-4 w-4" />
            Show all photos
          </button>

          {/* Badges */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            {property.verified && (
              <span className="bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full uppercase tracking-wider font-semibold border border-white/20">
                Verified
              </span>
            )}
            {property.isNew && (
              <span className="bg-primary text-white text-xs px-3 py-1.5 rounded-full uppercase tracking-wider font-semibold">
                New Listing
              </span>
            )}
          </div>
        </div>

        {/* Title row below gallery */}
        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
              {property.title}
            </h1>
            <div className="flex items-center text-gray-400 gap-1.5">
              <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-base">{property.fullAddress}</span>
            </div>
          </div>
          <LikeButton id={String(property.id)} size="lg" className="flex-shrink-0 mt-1" />
        </div>
      </div>

      {/* ── Mobile: full-bleed carousel ── */}
      <div className="md:hidden relative w-full h-[55vw] min-h-[260px] overflow-hidden group">
        <AnimatePresence mode="wait">
          <motion.button
            key={current}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full h-full block cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
          >
            <Image
              src={property.images[current]}
              alt={`${property.title} – ${current + 1}`}
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
          </motion.button>
        </AnimatePresence>

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(18,18,18,0.3)] to-[rgba(18,18,18,0.85)] pointer-events-none" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
          {property.verified && (
            <span className="bg-black/50 backdrop-blur-sm text-white text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold border border-white/20">
              Verified
            </span>
          )}
          {property.isNew && (
            <span className="bg-primary text-white text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">
              New
            </span>
          )}
        </div>
        <LikeButton id={String(property.id)} className="absolute top-3 right-3 z-10" />

        {/* Mobile title overlay */}
        <div className="absolute bottom-0 left-0 w-full px-4 pb-4 z-10">
          <h1 className="text-xl font-bold text-white tracking-tight leading-snug">
            {property.title}
          </h1>
          <div className="flex items-center text-gray-300 gap-1 mt-0.5">
            <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span className="text-sm line-clamp-1">{property.fullAddress}</span>
          </div>
        </div>

        {/* Prev / Next — always visible on mobile with proper touch targets */}
        {hasMultiple && (
          <>
            <button
              onClick={prev}
              aria-label="Previous photo"
              className="absolute top-1/2 left-3 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center z-10 active:scale-95 transition-transform"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next photo"
              className="absolute top-1/2 right-3 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center z-10 active:scale-95 transition-transform"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dot indicators — min 44px touch target via padding */}
        {hasMultiple && (
          <div className="absolute bottom-14 right-3 z-20 flex items-center gap-1">
            {property.images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Photo ${i + 1}`}
                className="p-2.5"
              >
                <span
                  className={`block w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                    i === current ? "bg-white" : "bg-white/40"
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <ImageLightbox
        images={property.images}
        currentIndex={current}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setCurrent}
      />
    </>
  );
}
