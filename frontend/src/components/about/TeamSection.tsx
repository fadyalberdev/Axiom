"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const TEAM = [
  {
    name: "Fady Alber",
    role: "CEO & Co-Founder",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB_4SvcWoGcNeLbmGkFWtvLLLbuDgZVAW1Vt0-MKRFxdPra44gHP1PGCvcdXlhWwgw49mX4x7YJaxJgkWwuw8J4g4zg_2lo8oRD90_zfTxebHh2iBxiJqMNehmKdDXP5r2pLHRFJ3kUmSLSjv21iDfPwCvoZBYSZ4-FLbYcaHclTWDCUSUeE-IbmSSqwbA2GdcVePVfZ-V39KGMmMiQRHot8o1UtZKxDkr0k6VtFsdgGpFqmRNltwxE5nB6Z7PCKiFkiPJ5G5S-ld--",
    bio: "Former Director of Urban Planning with a vision for smarter cities. Sarah leads our strategic growth and urban integration initiatives.",
  },
  {
    name: "Baher Mohamed",
    role: "Chief Technology Officer",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBibdq75F1VTpKHQtvVZZwBvVl3R1E9pSbyET56uJKdzajSf9cOjRXTF9Wz9ZzE9ddO_eTDjp-yIQes4meJbG6FBtGUqNn-tiH2FMhwP6_HPIxcfVIBRrL-OA7ew46dttyWX-FZ9TwDEFS1-7MFT_LQbUbRmYdsai4BWEJlh3PVNb0REHIdcyg3-TpiQazIw10LwSxeyWrrBvxgnkhTYqvBvn2sFlnlBAc_r-kyHJK-s_ym8zTi9noH39hUeHAb2Dh0NICKgM_mX00Q",
    bio: "AI researcher specializing in predictive behavioral modeling. David architectures the core machine learning engine behind Axiom's matching system.",
  },
  {
    name: "Abanoub Attia",
    role: "Head of Operations",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCa0fy98t2PE0mzURm78ZcUB19Dxx-6i5y5L8ZoKj4xjXf54-xtPNemSEp1P7z8nHfaFIok9w7iE9m3xXPbuSNTmQaAVouVmLf8Bdbr-9PWR3DMAIqv590wXmphqQGuN6gGo66YRQ4WenHi9hM5k5CPX3zgiunyF1kVokyriOznJZpf8iUcLjciW0PT5NnPpFDFVyw_HlMzQ_YcKu4FdbTezBShp2uUQTOh9cPerlRFAVq0YmcJmoIAssiwMXT-AAWp5MzjccuRMZ8u",
    bio: "Scaling real estate networks across major metropolitan hubs. Elena ensures our platform operates smoothly across hundreds of global markets.",
  },
  {
    name: "Ehab Ashraf",
    role: "VP of Product",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA3NBcgn5tNDlZemxp_zFAydpReYVPOG93ZwywoFZhhDT4gXhh4ocsOMgtJZVaHLmYVRIoPTVZIBCd58xRlR-hl5ocQTg8qoqWSiBiTuBB90XWU0a7fOP368BMyQfWX7AxKDAu0ShxBUPWJujYjbGxjXlQCkKrvBWaxS7UuCncMK0aSBObBA6jkCrNAlYF76PXke1CPRoL299b1y4NILgsz06UQLfip3OX4E2d_K4RmPhL2NzXjxuzprNNhDE7lJEjLmcXaWHt5fT5v",
    bio: "Designing seamless digital experiences for the modern tenant. Marcus translates user needs into beautiful, functional platform features.",
  },
  {
    name: "Youssef Mohamed ",
    role: "VP of Product",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA3NBcgn5tNDlZemxp_zFAydpReYVPOG93ZwywoFZhhDT4gXhh4ocsOMgtJZVaHLmYVRIoPTVZIBCd58xRlR-hl5ocQTg8qoqWSiBiTuBB90XWU0a7fOP368BMyQfWX7AxKDAu0ShxBUPWJujYjbGxjXlQCkKrvBWaxS7UuCncMK0aSBObBA6jkCrNAlYF76PXke1CPRoL299b1y4NILgsz06UQLfip3OX4E2d_K4RmPhL2NzXjxuzprNNhDE7lJEjLmcXaWHt5fT5v",
    bio: "Designing seamless digital experiences for the modern tenant. Marcus translates user needs into beautiful, functional platform features.",
  },
  {
    name: "Abdelrahman Wael ",
    role: "VP of Product",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA3NBcgn5tNDlZemxp_zFAydpReYVPOG93ZwywoFZhhDT4gXhh4ocsOMgtJZVaHLmYVRIoPTVZIBCd58xRlR-hl5ocQTg8qoqWSiBiTuBB90XWU0a7fOP368BMyQfWX7AxKDAu0ShxBUPWJujYjbGxjXlQCkKrvBWaxS7UuCncMK0aSBObBA6jkCrNAlYF76PXke1CPRoL299b1y4NILgsz06UQLfip3OX4E2d_K4RmPhL2NzXjxuzprNNhDE7lJEjLmcXaWHt5fT5v",
    bio: "Designing seamless digital experiences for the modern tenant. Marcus translates user needs into beautiful, functional platform features.",
  },
  {
    name: "Shrouk Saber",
    role: "VP of Product",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA3NBcgn5tNDlZemxp_zFAydpReYVPOG93ZwywoFZhhDT4gXhh4ocsOMgtJZVaHLmYVRIoPTVZIBCd58xRlR-hl5ocQTg8qoqWSiBiTuBB90XWU0a7fOP368BMyQfWX7AxKDAu0ShxBUPWJujYjbGxjXlQCkKrvBWaxS7UuCncMK0aSBObBA6jkCrNAlYF76PXke1CPRoL299b1y4NILgsz06UQLfip3OX4E2d_K4RmPhL2NzXjxuzprNNhDE7lJEjLmcXaWHt5fT5v",
    bio: "Designing seamless digital experiences for the modern tenant. Marcus translates user needs into beautiful, functional platform features.",
  },
];

export default function TeamSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-card-dark border border-white/5 rounded-3xl p-12"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-4">
        <div>
          <span className="text-primary font-bold tracking-[0.2em] uppercase text-xs mb-3 block">
            Leadership
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Meet the Visionaries
          </h2>
        </div>
        <p className="text-gray-400 text-sm max-w-sm">
          Driving the evolution of smart living through a diverse blend of urban
          planning, AI research, and operations expertise.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-16 gap-x-12">
        {TEAM.map((member, i) => (
          <motion.div
            key={member.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="flex gap-8 group"
          >
            <div className="relative w-48 h-56 shrink-0 rounded-2xl overflow-hidden border border-white/10 group-hover:border-primary transition-colors">
              <Image
                src={member.image}
                alt={member.name}
                fill
                className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                sizes="192px"
              />
            </div>
            <div className="flex flex-col justify-center">
              <h3 className="text-2xl font-bold text-white mb-1">
                {member.name}
              </h3>
              <p className="text-primary text-sm font-semibold mb-4 tracking-wide">
                {member.role}
              </p>
              <div className="h-px w-8 bg-white/20 mb-4" />
              <p className="text-gray-400 text-base leading-relaxed">
                {member.bio}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
