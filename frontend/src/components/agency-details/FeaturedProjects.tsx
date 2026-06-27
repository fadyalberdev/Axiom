"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AgencyProject } from "@/types";
import ProjectCard from "./ProjectCard";

interface FeaturedProjectsProps {
  projects: AgencyProject[];
}

const PREVIEW_COUNT = 3;

export default function FeaturedProjects({ projects }: FeaturedProjectsProps) {
  const [showAll, setShowAll] = useState(false);

  const hasMore = projects.length > PREVIEW_COUNT;
  const visible = showAll ? projects : projects.slice(0, PREVIEW_COUNT);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">Featured Projects</h2>
      </div>

      {projects.length === 0 ? (
        <p className="text-gray-500 text-sm">No projects listed.</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            {visible.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} linkBase="/project" />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all text-sm cursor-pointer"
              >
                {showAll ? "Show less" : `Show all projects (${projects.length})`}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
