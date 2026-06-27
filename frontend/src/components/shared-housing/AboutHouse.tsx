"use client";

import { motion } from "framer-motion";

interface AboutHouseProps {
  descriptions: string[];
}

export default function AboutHouse({ descriptions }: AboutHouseProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-white">About the House</h2>
      <div className="space-y-4">
        {descriptions.map((paragraph, i) => (
          <p
            key={i}
            className="text-gray-300 text-lg font-light leading-relaxed"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </motion.div>
  );
}
