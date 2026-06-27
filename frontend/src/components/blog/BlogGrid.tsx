"use client";

import { SearchX } from "lucide-react";
import type { BlogPostBrief } from "@/types/api";
import BlogCard from "./BlogCard";

interface BlogGridProps {
  posts: BlogPostBrief[];
  isLoading?: boolean;
  categories: string[];
  activeCategory: string;
  searchQuery: string;
  onCategoryChange: (category: string) => void;
}

export default function BlogGrid({
  posts,
  isLoading = false,
  categories,
  activeCategory,
  searchQuery,
  onCategoryChange,
}: BlogGridProps) {
  return (
    <div>
      <div className="flex flex-col gap-5 mb-8 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-primary text-xs font-bold uppercase tracking-[0.22em] mb-2">
            Journal
          </p>
          <h2 className="text-2xl font-bold text-white">Latest articles</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 text-sm font-medium text-gray-400 md:pb-0">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`shrink-0 rounded-full border px-4 py-2 transition-[border-color,background-color,color,transform] duration-200 ease-out active:scale-[0.98] ${
                category === activeCategory
                  ? "border-primary bg-primary text-white"
                  : "border-white/10 bg-white/[0.03] hover:border-primary/50 hover:text-white"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[420px] rounded-2xl border border-white/5 bg-card-dark overflow-hidden"
            >
              <div className="h-56 bg-white/[0.06] animate-pulse" />
              <div className="p-6 space-y-4">
                <div className="h-3 w-28 rounded bg-white/[0.08] animate-pulse" />
                <div className="h-5 w-4/5 rounded bg-white/[0.08] animate-pulse" />
                <div className="h-4 w-full rounded bg-white/[0.06] animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-white/[0.06] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card-dark p-10 text-center">
          <SearchX className="mx-auto mb-4 h-9 w-9 text-primary" />
          <h3 className="text-lg font-semibold text-white">No matching articles</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">
            {searchQuery
              ? `No AXIOM articles match "${searchQuery}" in this category.`
              : "No AXIOM articles are published in this category yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {posts.map((post, i) => (
            <BlogCard key={post.id} post={post} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
