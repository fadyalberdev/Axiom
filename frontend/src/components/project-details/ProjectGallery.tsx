"use client";

import Image from "next/image";
import { motion } from "framer-motion";

interface ProjectGalleryProps {
  images: string[];
  title: string;
}

export default function ProjectGallery({ images, title }: ProjectGalleryProps) {
  if (images.length === 0) return null;

  return (
    <motion.section
      id="project-gallery"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="scroll-mt-24"
    >
      <h3 className="text-2xl font-bold text-white mb-6">Gallery</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/5 bg-card-dark"
          >
            <Image
              src={src}
              alt={`${title} — image ${i + 1}`}
              fill
              className="object-cover transition-transform duration-300 hover:scale-105"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          </div>
        ))}
      </div>
    </motion.section>
  );
}
