"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Building2, BadgeCheck, Download, Images } from "lucide-react";
import type { ProjectDetail } from "@/types";

interface ProjectHeroProps {
  project: ProjectDetail;
}

export default function ProjectHero({ project }: ProjectHeroProps) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative h-[60vh] w-full overflow-hidden"
    >
      <div className="absolute inset-0">
        <Image
          src={project.image}
          alt={project.title}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-black/40 to-black/20" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 lg:p-16 flex items-end">
        <div className="bg-card-dark/60 backdrop-blur-xl p-8 rounded-2xl max-w-2xl w-full border border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center border border-white/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-sm text-primary font-bold uppercase tracking-wider">
                {project.developerName}
              </h2>
              {project.developerVerified && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified Developer
                </div>
              )}
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
            {project.title}
          </h1>
          <p className="text-lg text-gray-300 mb-6 font-light">
            {project.subtitle}
          </p>

          {(project.brochureUrl || project.gallery.length > 0) && (
            <div className="flex flex-wrap gap-4">
              {project.brochureUrl && (
                <a
                  href={project.brochureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-full font-medium transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" /> Download Brochure
                </a>
              )}
              {project.gallery.length > 0 && (
                <a
                  href="#project-gallery"
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-full font-medium backdrop-blur-md transition-all border border-white/10 flex items-center gap-2"
                >
                  <Images className="h-4 w-4" /> View Gallery
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
