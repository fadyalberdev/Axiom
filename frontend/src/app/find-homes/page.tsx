"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, LayoutList, Loader2, Sparkles, Search, X, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import FilterSidebar, {
  EMPTY_FILTERS,
  type FilterValues,
} from "@/components/find-homes/FilterSidebar";
import SearchListingCard from "@/components/find-homes/SearchListingCard";
import SearchListingRow from "@/components/find-homes/SearchListingRow";
import Pagination from "@/components/find-homes/Pagination";
import { getListings, parseSearchQuery } from "@/lib/supabase-queries";
import type { Listing } from "@/types";
import type { ListingBrief } from "@/types/api";

// ── Extracted to module scope so React never sees a new component type on re-render ──
function ListingGrid({ items, viewMode }: { items: Listing[]; viewMode: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-4">
        {items.map((listing, i) => (
          <motion.div
            key={listing.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 4) * 0.03, duration: 0.25 }}
          >
            <SearchListingRow listing={listing} />
          </motion.div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {items.map((listing, i) => (
        <motion.div
          key={listing.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 5) * 0.035, duration: 0.28 }}
        >
          <SearchListingCard listing={listing} />
        </motion.div>
      ))}
    </div>
  );
}

const SORT_OPTIONS = [
  { label: "Recommended", value: "newest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Most Viewed", value: "most_viewed" },
];

function mapToListing(l: ListingBrief): Listing {
  const tags: string[] = [];
  if (l.bedrooms != null) tags.push(`${l.bedrooms} Bed${l.bedrooms !== 1 ? "s" : ""}`);
  if (l.bathrooms != null) tags.push(`${l.bathrooms} Bath${l.bathrooms !== 1 ? "s" : ""}`);
  if (l.size_sqm != null) tags.push(`${l.size_sqm} m²`);
  if (l.property_type) tags.push(l.property_type);

  return {
    id: l.id,
    title: l.title,
    location: l.location,
    price: l.price,
    image: l.images[0] ?? "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
    matchPercent: 0,
    verified: l.verified,
    filledSpots: l.category === "shared_housing" ? 0 : 0,
    totalSpots: l.category === "shared_housing" ? 1 : 1,
    tags,
    avatars: [],
    liked: false,
    category: l.category,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    size_sqm: l.size_sqm,
    property_type: l.property_type,
    is_new: l.is_new,
    created_at: l.created_at,
  };
}

// Decides whether a query is natural-language (→ smart parse) or simple structured
const NL_PATTERNS = [
  /\b(i want|i need|i'm looking|looking for|find me|show me|give me)\b/i,
  /\b(near|close to|next to|walking distance|minutes from)\b/i,
  /\b(quiet|cozy|modern|luxury|spacious|vibrant|peaceful|lively|charming)\b/i,
  /\b(vibe|lifestyle|atmosphere|feel|good for|perfect for|suitable for)\b/i,
  /\b(family|couples?|singles?|students?|professionals?)\b/i,
  /\b(affordable|cheap|budget|expensive|high.?end)\b/i,
];

function detectSearchMode(query: string): "regular" | "ai" {
  const q = query.trim();
  if (!q) return "regular";
  if (NL_PATTERNS.some((re) => re.test(q))) return "ai";
  // Long free-form query with no obvious structure → AI
  if (q.split(/\s+/).length > 6) return "ai";
  return "regular";
}

export default function FindHomesPage() {
  const searchParams = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [draftFilters, setDraftFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(EMPTY_FILTERS);

  // Unified search state
  const [inputValue, setInputValue] = useState(() => searchParams.get("q") ?? "");
  const [searchText, setSearchText] = useState(() => searchParams.get("q") ?? "");
  const [appliedQuery, setAppliedQuery] = useState(() => searchParams.get("q") ?? "");

  // Detected mode updates as user types (for indicator only)
  const detectedMode = detectSearchMode(inputValue);
  // Parsed chips shown after submit
  const parsedChips = appliedQuery ? parseSearchQuery(appliedQuery) : null;

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // Sync when URL ?q param changes (navbar search from any page)
  const urlQuery = searchParams.get("q") ?? "";
  useEffect(() => {
    if (urlQuery === appliedQuery) return;
    setInputValue(urlQuery);
    setSearchText(urlQuery);
    setAppliedQuery(urlQuery);
    setCurrentPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery]);

  // Agency / project pre-filter from URL (set by agency page "View All" links)
  const agencyIdParam = searchParams.get("agency_id") ?? undefined;
  const projectIdParam = searchParams.get("project_id") ?? undefined;

  const queryFilters = useMemo(() => ({
    sort_by: sortBy,
    page: currentPage,
    per_page: 12,
    search: searchText || undefined,
    category: appliedFilters.category || undefined,
    property_type: appliedFilters.propertyType || undefined,
    min_price: appliedFilters.minPrice,
    max_price: appliedFilters.maxPrice,
    bedrooms: appliedFilters.bedrooms,
    bathrooms: appliedFilters.bathrooms,
    min_size_sqm: appliedFilters.minSize,
    max_size_sqm: appliedFilters.maxSize,
    lease_type: appliedFilters.leaseType || undefined,
    room_type: appliedFilters.roomType || undefined,
    utilities_included: appliedFilters.utilitiesIncluded,
    amenities: appliedFilters.amenities.length ? appliedFilters.amenities : undefined,
    agency_id: agencyIdParam,
    project_id: projectIdParam,
  }), [sortBy, currentPage, searchText, appliedFilters, agencyIdParam, projectIdParam]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["listings", queryFilters],
    queryFn: () => getListings(queryFilters),
    staleTime: 0,
  });

  const listings = (data?.listings ?? []).map(mapToListing);
  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1;

  function handleSubmit() {
    const q = inputValue.trim();
    setSearchText(q);
    setAppliedQuery(q);
    setCurrentPage(1);
  }

  function clearSearch() {
    setInputValue("");
    setSearchText("");
    setAppliedQuery("");
    setCurrentPage(1);
  }

  const filterProps = useMemo(() => ({
    values: draftFilters,
    onChange: setDraftFilters,
    onApply: (filters: FilterValues) => {
      setAppliedFilters(filters);
      setCurrentPage(1);
    },
    onReset: () => {
      setDraftFilters(EMPTY_FILTERS);
      setAppliedFilters(EMPTY_FILTERS);
      setCurrentPage(1);
    },
  }), [draftFilters]);

  return (
    <main className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-64px)] lg:overflow-hidden w-full">
      {/* Desktop sidebar — visible lg+ only */}
      <aside className="hidden lg:flex lg:w-80 lg:shrink-0 lg:border-r border-white/10 h-full">
        <FilterSidebar {...filterProps} />
      </aside>

      <section className="flex-1 h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Find Homes</h1>
            <p className="text-sm text-gray-400">
              {isLoading
                ? "Loading properties…"
                : `Showing ${data?.total ?? 0} properties${searchText ? ` for "${searchText}"` : ""}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mobile filter trigger — hidden on desktop */}
            {isMounted && <Sheet>
              <SheetTrigger asChild>
                <button aria-label="Open filters" className="lg:hidden inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-card-dark border border-white/10 text-white text-sm font-medium">
                  <SlidersHorizontal className="h-4 w-4" /> Filters
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-sm p-0 bg-surface border-r border-white/10">
                <SheetTitle className="sr-only">Filters</SheetTitle>
                <FilterSidebar {...filterProps} />
              </SheetContent>
            </Sheet>}

            {/* View mode toggle */}
            <div className="flex items-center bg-card-dark rounded-lg p-1 border border-white/5">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
                  viewMode === "grid" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
                  viewMode === "list" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" /> List
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="bg-card-dark border-white/5 text-gray-300 text-xs rounded-lg py-2 px-3 focus:ring-primary border"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Unified smart search bar */}
        <div className="mb-6">
          <div className="relative flex gap-3">
            <div className="relative flex-1">
              {/* Mode indicator icon */}
              <AnimatePresence mode="wait">
                {detectedMode === "ai" ? (
                  <motion.span
                    key="ai"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="regular"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  >
                    <Search className="h-4 w-4 text-gray-400" />
                  </motion.span>
                )}
              </AnimatePresence>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Search by location, name, budget… or describe your ideal home"
                className={`w-full bg-card-dark rounded-xl pl-11 pr-10 py-3.5 text-white placeholder-gray-500 focus:outline-none transition-all text-sm border ${
                  detectedMode === "ai"
                    ? "border-primary/50 focus:ring-1 focus:ring-primary focus:border-primary"
                    : "border-white/10 focus:ring-1 focus:ring-primary/50"
                }`}
              />

              {inputValue && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-5 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/25 whitespace-nowrap"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : detectedMode === "ai" ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {detectedMode === "ai" ? "AI Search" : "Search"}
            </button>
          </div>

          {/* Mode hint */}
          {inputValue && (
            <p className="mt-2 text-xs text-gray-500 pl-1">
              {detectedMode === "ai"
                ? "✦ Smart search — understands natural language, budget, amenities & lifestyle"
                : "⚡ Instant search — searching titles, locations, amenities & budget"}
            </p>
          )}

          {/* Parsed intent chips */}
          <AnimatePresence>
            {parsedChips && (
              parsedChips.text ||
              parsedChips.maxPrice ||
              parsedChips.minPrice ||
              parsedChips.bedrooms ||
              parsedChips.propertyType ||
              parsedChips.category ||
              parsedChips.amenities.length > 0
            ) && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-wrap gap-2 mt-3"
              >
                <span className="text-xs text-gray-500 self-center">Understood:</span>
                {parsedChips.text && (
                  <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-medium">
                    🔍 {parsedChips.text}
                  </span>
                )}
                {parsedChips.maxPrice && (
                  <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-medium">
                    💰 Max {parsedChips.maxPrice.toLocaleString()} EGP
                  </span>
                )}
                {parsedChips.minPrice && (
                  <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-medium">
                    💰 Min {parsedChips.minPrice.toLocaleString()} EGP
                  </span>
                )}
                {parsedChips.bedrooms && (
                  <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-medium">
                    🛏 {parsedChips.bedrooms} bedrooms
                  </span>
                )}
                {parsedChips.propertyType && (
                  <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-medium">
                    🏠 {parsedChips.propertyType}
                  </span>
                )}
                {parsedChips.category && (
                  <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-medium">
                    🏢 {parsedChips.category}
                  </span>
                )}
                {parsedChips.amenities.map((v) => (
                  <span key={v} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300">
                    ✨ {v}
                  </span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="text-center text-red-400 py-20">
            Failed to load listings. Make sure the backend is running.
          </p>
        )}

        {/* Results */}
        {!isLoading && !isError && (
          <>
            {listings.length === 0 ? (
              <p className="text-center text-gray-500 py-20">No listings found.</p>
            ) : (
              <ListingGrid items={listings} viewMode={viewMode} />
            )}
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </section>
    </main>
  );
}
