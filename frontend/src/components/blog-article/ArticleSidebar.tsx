"use client";

import { useState } from "react";
import { Link as LinkIcon, Check } from "lucide-react";
import type { BlogArticle } from "@/types";

interface ArticleSidebarProps {
  article: BlogArticle;
}

function slugHeading(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function ArticleSidebar({ article }: ArticleSidebarProps) {
  const [copied, setCopied] = useState(false);

  const headings = article.content
    .filter((b) => b.type === "heading")
    .map((b) => ({ text: (b as { type: "heading"; text: string }).text, id: slugHeading((b as { type: "heading"; text: string }).text) }));

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
    }
  }

  const shareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(window.location.href)}`,
      "_blank"
    );
  };

  const shareLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`,
      "_blank"
    );
  };

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 space-y-6">
        {/* Table of Contents */}
        {headings.length > 0 && (
          <div className="bg-card-dark rounded-2xl border border-white/5 p-5">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              Table of Contents
            </h3>
            <nav className="space-y-1">
              {headings.map((h) => (
                <button
                  key={h.id}
                  onClick={() => scrollTo(h.id)}
                  className="block w-full text-left text-gray-400 hover:text-primary text-sm py-1.5 px-3 rounded-lg hover:bg-white/5 transition-colors leading-snug"
                >
                  {h.text}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Share */}
        <div className="bg-card-dark rounded-2xl border border-white/5 p-5">
          <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
            Share Article
          </h3>
          <div className="flex gap-2">
            {/* Twitter / X */}
            <button
              onClick={shareTwitter}
              className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-primary flex items-center justify-center transition-all"
              title="Share on X"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.635L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
              </svg>
            </button>
            {/* LinkedIn */}
            <button
              onClick={shareLinkedIn}
              className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-primary flex items-center justify-center transition-all"
              title="Share on LinkedIn"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </button>
            {/* Copy link */}
            <button
              onClick={copyLink}
              className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-primary flex items-center justify-center transition-all"
              title="Copy link"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <LinkIcon className="h-4 w-4" />}
            </button>
          </div>
          {copied && (
            <p className="text-green-400 text-xs text-center mt-2">Link copied!</p>
          )}
        </div>
      </div>
    </aside>
  );
}
