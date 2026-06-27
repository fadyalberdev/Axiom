"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { BlogPostBrief } from "@/types/api";

const FALLBACK_IMAGE =
  "https://picsum.photos/seed/axiom-property-journal/900/650";

interface BlogCardProps {
  post: BlogPostBrief;
  index: number;
}

export default function BlogCard({ post, index }: BlogCardProps) {
  const date = formatDate(post.published_at);

  return (
    <Link href={`/blog/${post.slug}`} className="block h-full">
      <motion.article
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ delay: Math.min(index * 0.06, 0.24), duration: 0.35 }}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-card-dark shadow-lg transition-[border-color,transform] duration-300 ease-out hover:-translate-y-1 hover:border-primary/30"
      >
        <div className="relative h-60 overflow-hidden">
          <Image
            src={post.image_url ?? FALLBACK_IMAGE}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(min-width: 1024px) 430px, (min-width: 640px) 50vw, 100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          {post.category && (
            <div className="absolute left-4 top-4">
              <span className="rounded-full border border-primary/30 bg-background-dark/85 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
                {post.category}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {date && (
              <>
                <span>{date}</span>
                <span>/</span>
              </>
            )}
            <span>{post.read_time ?? "4 min read"}</span>
            <span>/</span>
            <span>{post.author_name ?? "AXIOM Editorial"}</span>
          </div>

          <h3 className="mb-2 line-clamp-2 text-lg font-bold leading-snug text-white transition-colors group-hover:text-primary">
            {post.title}
          </h3>

          {post.subtitle && (
            <p className="mb-5 line-clamp-3 text-sm leading-relaxed text-gray-400">
              {post.subtitle}
            </p>
          )}

          <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary transition-[gap] group-hover:gap-2">
            Read more <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </motion.article>
    </Link>
  );
}
