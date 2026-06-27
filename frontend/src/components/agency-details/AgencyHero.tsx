"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import type { AgencyDetail } from "@/types";

interface AgencyHeroProps {
  agency: AgencyDetail;
}

export default function AgencyHero({ agency }: AgencyHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative w-full h-[50vh] overflow-hidden"
    >
      {agency.bannerImage ? (
        <Image
          src={agency.bannerImage}
          alt={`${agency.name} Banner`}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-background-dark via-card-dark to-black" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background-dark/40 to-background-dark/95 pointer-events-none" />

      <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 z-10">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-primary/90 text-white text-xs px-3 py-1 rounded-full uppercase tracking-wider font-semibold">
                Luxury Developer Profile
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              {agency.name}
            </h1>
            <div className="flex items-center text-gray-300 gap-2 mt-1">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-lg">{agency.location}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
