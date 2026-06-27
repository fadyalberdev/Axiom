"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { BlogPostBrief } from "@/types/api";

const FALLBACK_IMAGE = "https://picsum.photos/seed/axiom-cairo-market/1600/950";

interface BlogHeroProps {
  post: BlogPostBrief | null;
  isLoading?: boolean;
}

export default function BlogHero({ post, isLoading = false }: BlogHeroProps) {
  const image = post?.image_url ?? FALLBACK_IMAGE;
  const href = post ? `/blog/${post.slug}` : "/find-homes";

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative min-h-[620px] pt-32 pb-16 lg:pt-44 lg:pb-20 overflow-hidden group"
    >
      <div className="absolute inset-0 z-0">
        <Image
          src={image}
          alt={post?.title ?? "AXIOM real estate market editorial"}
          fill
          className="object-cover opacity-70 group-hover:scale-[1.03] transition-transform duration-1000 ease-out"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/80 to-background-dark/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background-dark via-background-dark/50 to-background-dark/10" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span className="bg-primary text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
              Latest insight
            </span>
            <span className="text-gray-300 text-sm font-medium flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> {formatDate(post?.published_at) || "Market insight"}
            </span>
            <span className="text-gray-300 text-sm font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {post?.read_time ?? "4 min read"}
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
            {isLoading ? "AXIOM Journal" : post?.title ?? "Egypt property notes for smarter decisions"}
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 font-light leading-relaxed">
            {post?.subtitle ??
              "Local market reads, renting guides, and shared-housing advice for people comparing real homes in Egypt."}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={href}
              className="bg-primary hover:bg-primary-hover active:scale-[0.98] text-white font-semibold py-3 px-7 rounded-full transition-[background-color,transform] duration-200 ease-out shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              {post ? "Read article" : "Browse homes"} <ArrowRight className="h-5 w-5" />
            </Link>
            <span className="text-sm text-gray-300">
              By {post?.author_name ?? "AXIOM Editorial"}
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
