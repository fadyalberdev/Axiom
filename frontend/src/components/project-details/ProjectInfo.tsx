"use client";

import {
  Waves,
  Dumbbell,
  Ship,
  Car,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import type { ProjectDetail } from "@/types";

const ICON_MAP: Record<string, React.ElementType> = {
  Waves,
  Dumbbell,
  Ship,
  Car,
  ShieldCheck,
};

interface ProjectInfoProps {
  project: ProjectDetail;
}

export default function ProjectInfo({ project }: ProjectInfoProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Project Details</h3>
      </div>

      <div className="bg-card-dark rounded-2xl p-8 border border-white/5">
        <p className="text-gray-300 leading-relaxed mb-8 text-lg font-light">
          {project.description}
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/5">
          <div>
            <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">
              Completion
            </span>
            <span className="text-white font-semibold text-lg">
              {project.completion}
            </span>
          </div>
          <div>
            <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">
              Units Total
            </span>
            <span className="text-white font-semibold text-lg">
              {project.unitsTotal}
            </span>
          </div>
          <div>
            <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">
              Starting Price
            </span>
            <span className="text-white font-semibold text-lg">
              {project.startingPrice}
            </span>
          </div>
          <div>
            <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">
              Status
            </span>
            <span className="text-green-400 font-semibold text-lg flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              {project.status}
            </span>
          </div>
        </div>

        {/* Key Features */}
        <div className="mt-8">
          <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
            Key Features
          </h4>
          <div className="flex flex-wrap gap-3">
            {project.keyFeatures.map((feature) => {
              const Icon = ICON_MAP[feature.icon];
              return (
                <span
                  key={feature.label}
                  className="px-4 py-2 bg-white/5 rounded-full text-sm text-gray-300 border border-white/10 flex items-center gap-2"
                >
                  {Icon && <Icon className="h-4 w-4 text-primary" />}
                  {feature.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
