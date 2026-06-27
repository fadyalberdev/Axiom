"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { Residence } from "@/types";

interface ResidenceCardProps {
  residence: Residence;
  index: number;
}

export default function ResidenceCard({ residence, index }: ResidenceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="bg-card-dark rounded-2xl overflow-hidden border border-white/5 group hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-black/50 flex flex-col"
    >
      <div className="relative h-64">
        <Image
          src={residence.image}
          alt={residence.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-700"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
        />
        <div className="absolute top-4 left-4 bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
          For Sale
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="mb-4">
          <h3 className="text-white font-bold text-xl leading-tight mb-1">
            {residence.title}
          </h3>
          <p className="text-gray-400 text-sm">{residence.subtitle}</p>
        </div>

        {/* Specs grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 py-4 border-t border-b border-white/5 mb-4">
          <div className="text-center">
            <span className="block text-gray-500 text-[10px] uppercase">
              Beds
            </span>
            <span className="text-white font-semibold">{residence.beds}</span>
          </div>
          <div className="text-center border-l border-white/5">
            <span className="block text-gray-500 text-[10px] uppercase">
              Baths
            </span>
            <span className="text-white font-semibold">{residence.baths}</span>
          </div>
          <div className="text-center border-l border-white/5">
            <span className="block text-gray-500 text-[10px] uppercase">
              Size
            </span>
            <span className="text-white font-semibold">{residence.size}</span>
          </div>
        </div>

        <div className="mt-auto flex justify-between items-center">
          <div>
            <span className="text-gray-500 text-xs block">Starting from</span>
            <span className="text-primary font-bold text-2xl">
              {residence.price}
            </span>
          </div>
          <Link
            href={`/property/${residence.id}`}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-primary text-gray-300 hover:text-white flex items-center justify-center transition-colors border border-white/10"
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
