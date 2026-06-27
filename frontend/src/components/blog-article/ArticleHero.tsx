"use client";

import Image from "next/image";
import { Calendar, Clock } from "lucide-react";
import type { BlogArticle } from "@/types";

function AuthorAvatar({ name, avatar }: { name: string; avatar: string }) {
  if (avatar) {
    return (
      <Image
        src={avatar}
        alt={name}
        width={48}
        height={48}
        className="rounded-full border-2 border-primary object-cover"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="w-12 h-12 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
      {initials}
    </div>
  );
}

interface ArticleHeroProps {
  article: BlogArticle;
}

export default function ArticleHero({ article }: ArticleHeroProps) {
  return (
    <section className="relative h-[80vh] min-h-[600px] w-full group overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src={article.image}
          alt={article.title}
          fill
          className="object-cover opacity-70 transition-transform duration-1000 group-hover:scale-105"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-20 text-center">
        {/* Meta */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="bg-primary text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
            {article.category}
          </span>
          <span className="text-gray-300 text-sm font-medium flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> {article.date}
          </span>
          <span className="text-gray-300 text-sm font-medium flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {article.readTime}
          </span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight tracking-tight [text-shadow:0_4px_12px_rgba(0,0,0,0.5)]">
          {article.title}
        </h1>

        {/* Author */}
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-3">
            <AuthorAvatar name={article.author.name} avatar={article.author.avatar} />
            <div className="text-left">
              <p className="text-white font-semibold text-sm">
                {article.author.name}
              </p>
              <p className="text-gray-400 text-xs">{article.author.role}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
