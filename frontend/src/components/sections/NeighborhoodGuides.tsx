"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { blogQueries } from "@/lib/queries";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1600607686527-6fb886090705?w=800&q=80";

export default function NeighborhoodGuides() {
  const { data, isLoading, isError } = useQuery(
    blogQueries.list({ per_page: 4 })
  );

  const posts = data?.posts ?? [];

  return (
    <section className="py-20 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-bold text-white">
            Neighborhood Guides
          </h2>
          <Link
            href="/blog"
            className="text-primary text-sm font-semibold hover:text-primary-hover flex items-center gap-1 group"
          >
            View all guides{" "}
            <span className="group-hover:translate-x-1 transition-transform">
              &rarr;
            </span>
          </Link>
        </div>

        {isError && (
          <p className="text-gray-500 text-sm text-center py-8">
            Could not load neighborhood guides.
          </p>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-[4/5] rounded-2xl bg-card-dark animate-pulse border border-white/5"
              />
            ))}
          </div>
        )}

        {!isLoading && !isError && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="group relative aspect-[4/5] rounded-2xl overflow-hidden block"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 z-10" />
                  <Image
                    src={post.image_url ?? FALLBACK_IMAGE}
                    alt={post.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700 z-0"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  <div className="absolute bottom-5 left-5 right-5 z-20">
                    {post.category && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
                        {post.category}
                      </span>
                    )}
                    <h3 className="text-white font-bold text-base leading-snug line-clamp-2">
                      {post.title}
                    </h3>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
