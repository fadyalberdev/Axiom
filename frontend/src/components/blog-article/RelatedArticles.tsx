"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { RelatedArticle } from "@/types";

interface RelatedArticlesProps {
  articles: RelatedArticle[];
}

export default function RelatedArticles({ articles }: RelatedArticlesProps) {
  return (
    <section className="py-20 bg-background-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-bold text-white">Related Articles</h2>
          <Link
            href="/blog"
            className="text-primary text-sm font-semibold hover:text-primary-hover flex items-center gap-1 transition-colors"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex overflow-x-auto pb-8 gap-6 hide-scrollbar snap-x">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/blog/${article.slug}`}
              className="min-w-[300px] md:min-w-[350px] snap-center group flex flex-col bg-card-dark rounded-2xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 shadow-lg"
            >
              <div className="relative h-48 overflow-hidden">
                <Image
                  src={article.image}
                  alt={article.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  sizes="350px"
                />
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full uppercase tracking-wide">
                  {article.category}
                </div>
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>
                <div className="mt-auto flex items-center text-xs text-gray-500 gap-3">
                  <span>{article.date}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-600" />
                  <span>{article.readTime}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
