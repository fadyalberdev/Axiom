"use client";

import { motion } from "framer-motion";
import { Building2, LayoutList, MapPin } from "lucide-react";

const STATS = [
  { icon: Building2, value: "50+", label: "Developers" },
  { icon: LayoutList, value: "2,000+", label: "Listings" },
  { icon: MapPin, value: "10+", label: "Cities" },
];

export default function AgenciesHero() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative pt-32 pb-20 bg-cover bg-center"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(18,18,18,0.65), rgba(18,18,18,0.97)), url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2400&q=80')",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-primary text-xs font-bold uppercase tracking-[0.2em] mb-4"
        >
          Trusted Partners
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight"
        >
          Real Estate <span className="text-primary">Developers</span> &amp;{" "}
          Partners
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.45 }}
          className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto font-light leading-relaxed"
        >
          Connect directly with top-tier real estate developers and leading
          universities to find verified listings and student housing
          opportunities.
        </motion.p>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.45 }}
          className="inline-flex items-center divide-x divide-white/10 bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm"
        >
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-2.5 px-6 py-3.5">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <div className="text-left">
                <p className="text-white font-bold text-base leading-none">{value}</p>
                <p className="text-gray-400 text-[11px] mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
