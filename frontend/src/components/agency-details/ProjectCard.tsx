"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bed, Ruler } from "lucide-react";
import type { AgencyProject } from "@/types";

interface ProjectCardProps {
  project: AgencyProject;
  index: number;
  linkBase?: string;
}

export default function ProjectCard({ project, index, linkBase = "/property" }: ProjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="group bg-card-dark rounded-2xl border border-white/5 overflow-hidden hover:border-primary/40 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-black/30"
    >
      {/* Image */}
      <div className="relative h-56 overflow-hidden">
        {project.image ? (
          <Image
            src={project.image}
            alt={project.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
        )}

        {/* Status badge — top left, dark backdrop */}
        <div className="absolute top-3 left-3">
          <span className="bg-black/60 backdrop-blur-md text-white text-xs font-medium px-3 py-1.5 rounded-full border border-white/10">
            {project.status}
          </span>
        </div>

        {/* Badge — top right, colored */}
        {project.badge && (
          <div className="absolute top-3 right-3">
            <span
              className={`${project.badgeColor ?? "bg-primary"} text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg`}
            >
              {project.badge}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors leading-tight">
            {project.title}
          </h3>
          <div className="text-right shrink-0 ml-3">
            <p className="text-white font-bold text-sm">{project.price}</p>
            <p className="text-gray-500 text-xs">{project.priceLabel}</p>
          </div>
        </div>

        <p className="text-gray-400 text-sm mb-3">{project.location}</p>

        <div className="flex items-center gap-4 text-gray-400 text-sm mb-4">
          <span className="flex items-center gap-1.5">
            <Bed className="h-3.5 w-3.5" />
            {project.beds}
          </span>
          <span className="flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5" />
            {project.area}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/5 h-1.5 rounded-full mb-2 overflow-hidden">
          <div
            className={`${project.progressColor} h-full rounded-full transition-all`}
            style={{ width: `${project.progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs text-gray-400 mb-4">
          <span>{project.progressLabel}</span>
          <span>{project.completionLabel}</span>
        </div>

        <Link
          href={`${linkBase}/${project.id}`}
          className="block w-full py-2.5 border border-white/10 hover:bg-white/5 hover:border-white/20 rounded-xl text-white text-sm font-medium transition-all text-center cursor-pointer"
        >
          {project.cta}
        </Link>
      </div>
    </motion.div>
  );
}
