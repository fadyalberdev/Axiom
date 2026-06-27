"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
}

/** Build a windowed list of page numbers around the current page. */
function buildPages(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  // Few pages → show them all, no ellipses.
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  // Window of pages immediately around the current page.
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push("ellipsis");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("ellipsis");

  pages.push(totalPages);
  return pages;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPages(currentPage, totalPages);
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  const arrowClass =
    "flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-card-dark text-gray-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-card-dark disabled:hover:text-gray-300";

  return (
    <nav
      aria-label="Pagination"
      className="mt-12 flex items-center justify-center gap-1.5 pb-12 sm:gap-2"
    >
      <button
        type="button"
        onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
        disabled={isFirst}
        aria-label="Previous page"
        className={arrowClass}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {pages.map((page, i) =>
        page === "ellipsis" ? (
          <span
            key={`e-${i}`}
            aria-hidden="true"
            className="flex h-10 w-8 items-end justify-center pb-2 text-gray-600 sm:w-10"
          >
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange?.(page)}
            aria-current={page === currentPage ? "page" : undefined}
            aria-label={`Page ${page}`}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition-colors ${
              page === currentPage
                ? "bg-primary text-white shadow-lg shadow-primary/25"
                : "border border-white/10 bg-card-dark text-gray-300 hover:border-white/20 hover:bg-white/5 hover:text-white"
            }`}
          >
            {page}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
        disabled={isLast}
        aria-label="Next page"
        className={arrowClass}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </nav>
  );
}
