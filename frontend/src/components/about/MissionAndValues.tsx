"use client";

import Image from "next/image";
import { Rocket, ShieldCheck, Lightbulb, Users } from "lucide-react";
import { motion } from "framer-motion";

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Trust & Transparency",
    description: "Open market without hidden fees or biased algorithms.",
  },
  {
    icon: Lightbulb,
    title: "Innovation First",
    description: "Pushing boundaries using AI for complex human problems.",
  },
  {
    icon: Users,
    title: "User-Centric Design",
    description: "Technology serving people through empathetic features.",
  },
];

export default function MissionAndValues() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Mission */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="lg:col-span-8 bg-card-dark border border-white/5 rounded-3xl p-10 flex flex-col"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Our Mission</h2>
            <div className="w-12 h-1 bg-primary" />
          </div>
          <Rocket className="h-10 w-10 text-white/10" />
        </div>
        <div className="grid md:grid-cols-2 gap-8 flex-grow">
          <div className="space-y-4">
            <p className="text-gray-400 leading-relaxed text-sm">
              At Axiom, we are driven by a singular purpose: to revolutionize
              the rental experience through intelligent design and advanced
              technology. The traditional real estate market is fragmented and
              opaque. We are building a transparent, efficient ecosystem where
              landlords find reliable tenants and renters find homes that truly
              fit their lifestyle.
            </p>
            <p className="text-gray-400 leading-relaxed text-sm">
              By leveraging machine learning and predictive analytics, we remove
              the friction from the process, ensuring higher satisfaction rates
              and longer lease terms. We aren&apos;t just a platform; we are the
              future of living.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBibdq75F1VTpKHQtvVZZwBvVl3R1E9pSbyET56uJKdzajSf9cOjRXTF9Wz9ZzE9ddO_eTDjp-yIQes4meJbG6FBtGUqNn-tiH2FMhwP6_HPIxcfVIBRrL-OA7ew46dttyWX-FZ9TwDEFS1-7MFT_LQbUbRmYdsai4BWEJlh3PVNb0REHIdcyg3-TpiQazIw10LwSxeyWrrBvxgnkhTYqvBvn2sFlnlBAc_r-kyHJK-s_ym8zTi9noH39hUeHAb2Dh0NICKgM_mX00Q"
              alt="Modern interior detail"
              width={300}
              height={400}
              className="rounded-xl w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
            />
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDahSqwHuUwpGgeqZjJvepifTLfPOsU72PmnzYthgNkIr820Wv3e4wqu884PZ_MUvtCOsz7bZCfZd6gNme246VRdOr_GW0Rmpx77TLABQU24B43YYi61a_XpeUiWEi2cHjJAgGmDguzpeLf6yS9oUuWCiSEXcqdhRE6Hsff_Za1zDdc7uZ3TXO8qF0jwc2pdd5UuafW1zBvUBuVk9tHz090Kz_nJdb7kUSskdPt-YRQ5OHav7iLgDlR21i39OXHYtzD43EcYYQ8Vi4d"
              alt="Technology integration"
              width={300}
              height={400}
              className="rounded-xl w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
            />
          </div>
        </div>
      </motion.section>

      {/* Core Values */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="lg:col-span-4 flex flex-col gap-6"
      >
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 flex-grow">
          <h2 className="text-xl font-bold text-white mb-2">
            Our Core Values
          </h2>
          <p className="text-gray-400 text-sm mb-8">
            The principles guiding every algorithm and partnership.
          </p>
          <div className="space-y-6">
            {VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <div key={value.title} className="flex gap-4 group">
                  <div className="shrink-0 w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-1">
                      {value.title}
                    </h3>
                    <p className="text-gray-500 text-xs leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>
    </div>
  );
}
