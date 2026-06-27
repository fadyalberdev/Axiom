"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function CTASection() {
  return (
    <section className="bg-gradient-to-r from-primary to-[#FF7A5C] py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto px-4 text-center"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to find your vibe?
        </h2>
        <p className="text-white/90 mb-10 text-sm md:text-base max-w-xl mx-auto">
          Join thousands of verified members finding their perfect homes and
          roommates today.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {/* <Link
            href="/signup"
            className="bg-white text-primary font-bold py-3 px-8 rounded-full hover:bg-gray-100 transition-colors shadow-lg"
          >
            Get Started Free
          </Link> */}
          <Link
            href="/find-homes"
            className="bg-transparent border border-white text-white font-bold py-3 px-8 rounded-full hover:bg-white/10 transition-colors"
          >
            Browse Listings
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
