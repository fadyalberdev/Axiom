"use client";

import { useState, useMemo } from "react";
import { CheckCircle, Clock, CalendarClock, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import type { ProjectDetail } from "@/types";
import ResidenceCard from "./ResidenceCard";

const SORT_OPTIONS = [
  { value: "price_asc", label: "Sort by Price: Low to High" },
  { value: "price_desc", label: "Sort by Price: High to Low" },
  { value: "size_asc", label: "Sort by Size: Small to Large" },
  { value: "size_desc", label: "Sort by Size: Large to Small" },
];

function parsePrice(price: string): number {
  const lower = price.toLowerCase();
  const num = parseFloat(price.replace(/[^0-9.]/g, ""));
  if (lower.includes("m")) return num * 1_000_000;
  if (lower.includes("k")) return num * 1_000;
  return num;
}

function parseSize(size: string): number {
  return parseFloat(size.replace(/[^0-9.]/g, "")) || 0;
}

interface ResidencesGridProps {
  project: ProjectDetail;
}

export default function ResidencesGrid({ project }: ResidencesGridProps) {
  const [sort, setSort] = useState("price_asc");
  const status = project.status?.toLowerCase() ?? "";

  const sortedResidences = useMemo(() => {
    const res = [...project.residences];
    if (sort === "price_asc") res.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    else if (sort === "price_desc") res.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    else if (sort === "size_asc") res.sort((a, b) => parseSize(a.size) - parseSize(b.size));
    else if (sort === "size_desc") res.sort((a, b) => parseSize(b.size) - parseSize(a.size));
    return res;
  }, [project.residences, sort]);

  // Show card grid when residences are available
  if (project.residences.length > 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">Available Residences</h3>
            <p className="text-sm text-gray-400">
              Explore floor plans and pricing for this development
            </p>
          </div>
          <div className="relative shrink-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none bg-card-dark border border-white/10 text-white text-sm rounded-lg py-2.5 pl-4 pr-10 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedResidences.map((residence, index) => (
            <ResidenceCard key={residence.id} residence={residence} index={index} />
          ))}
        </div>
      </motion.section>
    );
  }

  // In-progress / under construction
  if (status === "in_progress" || status === "under_construction") {
    return (
      <section>
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-white mb-1">Unit Plans & Pricing</h3>
          <p className="text-sm text-gray-400">
            Units will be available once the project is completed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-card-dark rounded-2xl p-6 border border-white/5">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Starting Price</p>
            <p className="text-3xl font-bold text-primary">{project.startingPrice}</p>
          </div>
          <div className="bg-card-dark rounded-2xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-400 text-xs uppercase tracking-wider">Completion</p>
              <p className="text-white font-bold">{project.completion}</p>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: project.completion }}
              />
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-gray-400 text-xs">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>Expected Delivery: Est. 2027</span>
            </div>
          </div>
        </div>

        {project.keyFeatures.length > 0 && (
          <div className="bg-card-dark rounded-2xl p-6 border border-white/5">
            <h4 className="text-white font-bold mb-4">Included Features</h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {project.keyFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  {f.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  // Upcoming — teaser
  if (status === "upcoming") {
    return (
      <section>
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-white mb-1">Available Residences</h3>
        </div>
        <div className="bg-card-dark rounded-2xl border border-white/5 p-12 text-center">
          <Clock className="h-12 w-12 text-primary/40 mx-auto mb-4" />
          <h4 className="text-white font-bold text-xl mb-2">Coming Soon</h4>
          <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">
            This project hasn&apos;t launched yet. Starting price from{" "}
            <span className="text-primary font-semibold">{project.startingPrice}</span>.
          </p>
          <button className="bg-primary hover:bg-primary-hover text-white font-semibold px-6 py-3 rounded-xl transition-all">
            Register Interest
          </button>
        </div>
      </section>
    );
  }

  // Completed — show price summary
  return (
    <section>
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
        <div>
          <h3 className="text-2xl font-bold text-white mb-1">Available Residences</h3>
          <p className="text-sm text-gray-400">
            Explore available units in this completed development.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-card-dark rounded-2xl p-6 border border-white/5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Starting Price</p>
          <p className="text-3xl font-bold text-primary">{project.startingPrice}</p>
        </div>
        <div className="bg-card-dark rounded-2xl p-6 border border-white/5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Units</p>
          <p className="text-3xl font-bold text-white">{project.unitsTotal}</p>
        </div>
      </div>

      {project.keyFeatures.length > 0 && (
        <div className="bg-card-dark rounded-2xl p-6 border border-white/5">
          <h4 className="text-white font-bold mb-4">Unit Features</h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {project.keyFeatures.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
