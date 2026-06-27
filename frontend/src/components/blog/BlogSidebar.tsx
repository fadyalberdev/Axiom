"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { BlogPostBrief } from "@/types/api";

const FALLBACK_IMAGE = "https://picsum.photos/seed/axiom-blog-thumb/320/320";

interface BlogSidebarProps {
  posts: BlogPostBrief[];
  categories: string[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onCategorySelect: (category: string) => void;
}

export default function BlogSidebar({
  posts,
  categories,
  searchQuery,
  onSearchChange,
  onCategorySelect,
}: BlogSidebarProps) {
  const latestPosts = posts.slice(0, 4);

  return (
    <aside className="space-y-10 lg:sticky lg:top-24">
      <div className="bg-card-dark p-6 rounded-2xl border border-white/5">
        <h3 className="text-white font-bold text-lg mb-4">Search</h3>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-500" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Cairo rent, shared homes..."
            className="w-full bg-black/40 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div>
        <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
          <span className="w-1 h-6 bg-primary rounded-full" /> Latest reads
        </h3>
        <div className="space-y-6">
          {latestPosts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group flex gap-4 items-start"
            >
              <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden relative">
                <Image
                  src={post.image_url ?? FALLBACK_IMAGE}
                  alt={post.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  sizes="80px"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
              </div>
              <div>
                <span className="text-primary text-[10px] font-bold uppercase tracking-wide mb-1 block">
                  {post.category}
                </span>
                <h4 className="text-white text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
                  {post.title}
                </h4>
                <span className="text-gray-500 text-xs mt-1 block">
                  {formatDate(post.published_at) || "Recent"}
                </span>
              </div>
            </Link>
          ))}
          {latestPosts.length === 0 && (
            <p className="text-sm leading-6 text-gray-500">
              Published articles will appear here.
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
          <span className="w-1 h-6 bg-primary rounded-full" /> Topics
        </h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => onCategorySelect(topic)}
              className="px-3 py-1.5 bg-card-dark border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white hover:border-primary hover:bg-white/5 active:scale-[0.98] transition-[border-color,background-color,color,transform]"
            >
              {topic}
            </button>
          ))}
          {categories.length === 0 && (
            <span className="text-sm text-gray-500">No topics yet</span>
          )}
        </div>
      </div>

      <Link
        href="/find-homes"
        className="group flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 p-5 text-sm font-semibold text-white transition-[border-color,background-color,transform] duration-200 ease-out hover:border-primary hover:bg-primary/15 active:scale-[0.99]"
      >
        Browse matching homes
        <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
      </Link>
    </aside>
  );
}
