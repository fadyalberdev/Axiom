"use client";

import Image from "next/image";
import { Lightbulb, Link as LinkIcon } from "lucide-react";
import type { BlogArticle } from "@/types";

function slugHeading(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Strips script tags, event-handler attributes, and javascript: URLs.
// Runs on both server and client (no DOMParser dependency).
function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|iframe|object|embed|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/(<[^>]+)\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "$1")
    .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"');
}

interface ArticleBodyProps {
  article: BlogArticle;
}

export default function ArticleBody({ article }: ArticleBodyProps) {
  return (
    <article className="py-8 pb-16">
      <div className="max-w-3xl">
        {/* Lead paragraph */}
        <div className="prose prose-lg prose-invert max-w-none mb-16">
          <p className="text-xl md:text-2xl font-light leading-relaxed text-gray-300 mb-8 border-l-4 border-primary pl-6">
            {article.lead}
          </p>
        </div>

        {/* Content blocks */}
        <div className="prose prose-lg prose-invert max-w-none">
          {article.content.map((block, i) => {
            switch (block.type) {
              case "paragraph":
                return (
                  <p
                    key={i}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.text) }}
                  />
                );

              case "heading":
                return (
                  <h2
                    key={i}
                    id={slugHeading(block.text)}
                    className="text-3xl font-bold text-white mt-12 mb-6 scroll-mt-24"
                  >
                    {block.text}
                  </h2>
                );

              case "takeaways":
                return (
                  <div
                    key={i}
                    className="bg-card-dark rounded-2xl p-8 border border-white/5 my-16 shadow-xl not-prose"
                  >
                    <h3 className="text-primary font-bold text-lg mb-6 flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" /> Key Takeaways
                    </h3>
                    <ul className="space-y-4">
                      {block.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                            {j + 1}
                          </span>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {item}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );

              case "blockquote":
                return (
                  <div key={i} className="my-16 relative">
                    <span className="absolute -top-10 -left-6 text-primary/20 text-[120px] font-serif leading-none select-none">
                      &ldquo;
                    </span>
                    <blockquote className="text-2xl md:text-3xl font-bold text-center text-white leading-tight relative z-10 px-8 border-none pl-8">
                      &ldquo;{block.text}&rdquo;
                    </blockquote>
                    <div className="text-center mt-6">
                      <span className="text-primary text-sm font-semibold tracking-wide uppercase">
                        — {block.attribution}
                      </span>
                    </div>
                  </div>
                );

              case "list":
                return (
                  <ul
                    key={i}
                    className="list-disc pl-5 space-y-2 text-gray-300 marker:text-primary"
                  >
                    {block.items.map((item, j) => (
                      <li
                        key={j}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(item) }}
                      />
                    ))}
                  </ul>
                );

              default:
                return null;
            }
          })}
        </div>

        {/* Tags & Share */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap gap-2">
            <span className="text-gray-500 text-sm mr-2 py-1">Tags:</span>
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-full text-xs text-gray-300 transition-colors cursor-pointer"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-500 text-sm">Share:</span>
            {/* Twitter / X */}
            <button className="w-10 h-10 rounded-full bg-card-dark border border-white/10 text-gray-400 hover:text-primary hover:border-primary/50 flex items-center justify-center transition-all">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
              </svg>
            </button>
            {/* LinkedIn */}
            <button className="w-10 h-10 rounded-full bg-card-dark border border-white/10 text-gray-400 hover:text-primary hover:border-primary/50 flex items-center justify-center transition-all">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </button>
            {/* Copy link */}
            <button className="w-10 h-10 rounded-full bg-card-dark border border-white/10 text-gray-400 hover:text-primary hover:border-primary/50 flex items-center justify-center transition-all">
              <LinkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Author card */}
        <div className="mt-12 p-6 bg-card-dark rounded-2xl border border-white/5 flex items-start gap-5">
          {article.author.avatar ? (
            <Image
              src={article.author.avatar}
              alt={article.author.name}
              width={64}
              height={64}
              className="rounded-full border-2 border-primary/40 object-cover shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
              {article.author.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
          )}
          <div>
            <p className="text-white font-bold text-base">{article.author.name}</p>
            <p className="text-primary text-xs font-semibold uppercase tracking-wider mb-2">{article.author.role}</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Real estate expert at Aqary, covering property trends, market insights, and lifestyle topics across Egypt.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
