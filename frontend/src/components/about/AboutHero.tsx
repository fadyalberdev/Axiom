"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function AboutHero() {
  return (
    <motion.header
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-3xl overflow-hidden bg-card-dark border border-white/5 h-[400px]"
    >
      <Image
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIgpp5RaTRHgduce7EJNsecsSIvCfIcE7G8b-6UddfNkO6SwIluzJzuD2vJmVzf3P7SEtFr3eebmTH2GhU6sJsLqBW_M9k_4uTUnuTcUmFNHFCzhSCMmbR_prcpFUYDpGogXf0qXYQepi1KPrv2JveaYiKsNkY6GrgUSymxhAv7YKbYU_HvNVVGlWj95qcgr9co8da1CQsoOLdknAR6fT3a8vd4pGCTqv8z9tuHSTFB-nf9uqyqKm3Yvm0r8E-eRc_lYNvjZvL7Dqq"
        alt="Modern Architecture"
        fill
        className="object-cover opacity-40"
        priority
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent" />
      <div className="relative z-10 h-full flex flex-col justify-center px-12 max-w-4xl">
        <div className="inline-flex items-center gap-2 mb-4">
          <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-md">
            About Us
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
          Redefining Real Estate through AI
        </h1>
        <p className="text-lg md:text-xl text-gray-300 font-light leading-relaxed max-w-2xl border-l-2 border-primary pl-6">
          We believe finding a home isn&apos;t just about square footage — it&apos;s
          about compatibility. Axiom bridges the gap between data and human
          connection.
        </p>
      </div>
    </motion.header>
  );
}
