"use client";

import { motion } from "framer-motion";
import { HOW_IT_WORKS_STEPS } from "@/lib/constants";

export default function HowItWorksSection() {
  return (
    <section className="py-24 bg-background-dark border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <span className="text-primary text-xs font-bold tracking-widest uppercase mb-3 block">
          The Process
        </span>
        <h2 className="text-3xl font-bold text-white mb-4">
          How Axiom Works
        </h2>
        <p className="text-gray-400 max-w-xl mx-auto mb-16">
          Three simple steps to finding your perfect living situation without the
          usual headaches.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-10 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />

          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="w-20 h-20 rounded-full bg-card-dark border border-white/10 flex items-center justify-center text-2xl font-bold text-white shadow-xl mb-6 ring-4 ring-background-dark">
                <span className="text-primary/80">{step.number}</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-gray-400 max-w-xs px-4">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
