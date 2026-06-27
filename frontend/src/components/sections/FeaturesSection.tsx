"use client";

import { Sparkles, BadgeCheck, Store } from "lucide-react";
import { motion } from "framer-motion";
import { FEATURES } from "@/lib/constants";

const iconMap: Record<string, React.ElementType> = {
  Sparkles,
  BadgeCheck,
  Store,
};

export default function FeaturesSection() {
  return (
    <section className="py-16 bg-background-dark border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12 text-center">
          {FEATURES.map((feature, i) => {
            const Icon = iconMap[feature.icon] ?? Sparkles;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="group p-6 rounded-2xl hover:bg-white/5 transition-colors duration-300"
              >
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-primary/20 to-transparent rounded-2xl flex items-center justify-center border border-primary/20 group-hover:border-primary/50 transition-colors shadow-[0_0_15px_rgba(255,90,60,0.1)]">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-white text-lg font-bold mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
