"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import BlogHero from "@/components/blog/BlogHero";
import BlogGrid from "@/components/blog/BlogGrid";
import BlogSidebar from "@/components/blog/BlogSidebar";
import { getBlogPosts } from "@/lib/supabase-queries";

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["blog"],
    queryFn: () => getBlogPosts({ per_page: 20 }),
  });

  const posts = data?.posts ?? [];
  const featuredPost = posts[0] ?? null;

  const categories = useMemo(() => {
    const unique = new Set(
      posts
        .map((post) => post.category?.trim())
        .filter((category): category is string => Boolean(category))
    );
    return ["All", ...Array.from(unique)];
  }, [posts]);

  const visiblePosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesCategory =
        activeCategory === "All" ||
        post.category?.toLowerCase() === activeCategory.toLowerCase();
      const searchable = [post.title, post.subtitle, post.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = query.length === 0 || searchable.includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, posts, searchQuery]);

  return (
    <>
      <BlogHero post={featuredPost} isLoading={isLoading} />
      <section className="py-12 bg-background-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10 xl:gap-12">
            <div>
              <BlogGrid
                posts={visiblePosts}
                isLoading={isLoading}
                categories={categories}
                activeCategory={activeCategory}
                searchQuery={searchQuery}
                onCategoryChange={setActiveCategory}
              />
            </div>
            <div>
              <BlogSidebar
                posts={posts}
                categories={categories.filter((category) => category !== "All")}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCategorySelect={setActiveCategory}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
