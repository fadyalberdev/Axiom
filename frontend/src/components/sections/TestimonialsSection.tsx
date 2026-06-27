"use client";

import Image from "next/image";
import { Star, StarHalf } from "lucide-react";
import { motion } from "framer-motion";
import { TESTIMONIALS } from "@/lib/constants";

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating % 1 !== 0;
  return (
    <div className="flex text-yellow-500 mb-3 text-sm gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-current" />
      ))}
      {hasHalf && <StarHalf className="h-3.5 w-3.5 fill-current" />}
    </div>
  );
}

export default function TestimonialsSection() {
  return (
    <section className="py-20 bg-background-dark border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-16">
          People Love Living with Axiom
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 text-left">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-card-dark p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <Image
                  src={t.avatar}
                  alt={t.name}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
                <div>
                  <h4 className="text-white font-semibold text-sm">{t.name}</h4>
                  <p className="text-gray-500 text-[10px]">{t.subtitle}</p>
                </div>
              </div>
              <RatingStars rating={t.rating} />
              <p className="text-gray-400 text-sm italic">
                &ldquo;{t.quote}&rdquo;
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
