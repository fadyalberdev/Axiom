"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, GraduationCap, Users } from "lucide-react";
import type { ApiUniversity } from "@/types/api";

interface UniversityCardProps {
  university: ApiUniversity;
  index: number;
}

export default function UniversityCard({ university, index }: UniversityCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="bg-card-dark rounded-2xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary/5 group"
    >
      {/* Header */}
      <div className="h-32 bg-gray-800 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
        {university.banner_url ? (
          <Image
            src={university.banner_url}
            alt={`${university.name} campus`}
            fill
            className="object-cover mix-blend-overlay opacity-60"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
        )}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end z-20">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0">
            {university.logo_url ? (
              <Image
                src={university.logo_url}
                alt={university.name}
                width={48}
                height={48}
                className="object-contain"
                unoptimized
              />
            ) : (
              <GraduationCap className="h-6 w-6 text-primary" />
            )}
          </div>
          {university.type && (
            <div className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md border border-primary/20 capitalize">
              {university.type}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors line-clamp-1">
          {university.name}
        </h3>
        {university.city && (
          <div className="flex items-center gap-1 text-gray-400 text-xs mb-4">
            <MapPin className="h-3.5 w-3.5" /> {university.city}
          </div>
        )}

        <div className="space-y-2 mb-6">
          {university.student_count != null && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1">
                <Users className="h-3 w-3" /> Students
              </span>
              <span className="text-white">{university.student_count.toLocaleString()}</span>
            </div>
          )}
          {university.accreditation && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Accreditation</span>
              <span className="text-white text-xs truncate max-w-[120px]">{university.accreditation}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Active Listings</span>
            <span className="text-primary font-semibold">{university.listings_count}</span>
          </div>
        </div>

        <Link
          href={`/universities/${university.slug}`}
          className="block w-full py-2.5 border border-primary text-primary hover:bg-primary hover:text-white font-semibold rounded-lg transition-colors text-sm text-center"
        >
          View Student Housing
        </Link>
      </div>
    </motion.div>
  );
}
