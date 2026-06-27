"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, User, BedDouble, Bath, Maximize2, ArrowRight, AlertTriangle, RotateCcw } from "lucide-react";
import type { Citation } from "@/types";

// ── Markdown helpers ──────────────────────────────────────────────────────────

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

function MessageContent({ content }: { content: string }): ReactNode {
  const lines = content.split("\n");
  type Group =
    | { type: "bullet"; items: string[] }
    | { type: "text"; text: string }
    | { type: "br" };

  const groups: Group[] = [];

  for (const line of lines) {
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const last = groups[groups.length - 1];
      if (last?.type === "bullet") {
        last.items.push(line.slice(2));
      } else {
        groups.push({ type: "bullet", items: [line.slice(2)] });
      }
    } else if (line === "") {
      if (groups.length > 0 && groups[groups.length - 1].type !== "br") {
        groups.push({ type: "br" });
      }
    } else {
      groups.push({ type: "text", text: line });
    }
  }

  return (
    <>
      {groups.map((group, i) => {
        if (group.type === "bullet") {
          return (
            <ul key={i} className="list-disc list-inside space-y-0.5 mt-1 mb-1">
              {group.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (group.type === "br") return <br key={i} />;
        return (
          <span key={i} className="block">
            {renderInline(group.text)}
          </span>
        );
      })}
    </>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ListingRef {
  id: string;
  title: string;
  location: string;
  city?: string;
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  images: string[];
  property_type?: string;
  match_score?: number;
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  listing_refs?: ListingRef[];
  search_filters?: Record<string, unknown>;
  proximity_notice?: string;
  citations?: Citation[];
  timestamp: Date;
  isError?: boolean;
  retryPayload?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number, currency: string) {
  return `${price.toLocaleString("en-EG")} ${currency}`;
}

function buildSearchUrl(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  // Use the original user message as the NLP search query — find-homes parses
  // bedrooms, price, property type, and location from it automatically.
  if (filters._user_query) params.set("q", String(filters._user_query));
  // Agency and project IDs are explicit URL params (read by find-homes directly).
  if (filters.agency_id) params.set("agency_id", String(filters.agency_id));
  if (filters.project_id) params.set("project_id", String(filters.project_id));
  const qs = params.toString();
  return `/find-homes${qs ? `?${qs}` : ""}`;
}

// ── Listing card ──────────────────────────────────────────────────────────────

function ListingRefCard({ listing }: { listing: ListingRef }) {
  return (
    <Link
      href={`/property/${listing.id}`}
      className="flex items-center gap-3 bg-card border border-border rounded-xl p-2.5 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 transition-all group"
    >
      {/* Thumbnail */}
      <div className="relative w-16 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
        {listing.images?.[0] ? (
          <Image
            src={listing.images[0]}
            alt={listing.title}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <BedDouble className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors flex-1">
            {listing.title}
          </p>
          {/* Match score badge — only shown when meaningful (spec filters were present) */}
          {listing.match_score !== undefined && listing.match_score < 100 && (
            <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
              listing.match_score >= 70
                ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
                : "text-muted-foreground bg-secondary border-border"
            }`}>
              {listing.match_score}%
            </span>
          )}
          {listing.match_score === 100 && (
            <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border text-green-400 bg-green-400/10 border-green-400/30">
              ✓ Match
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {listing.location}
        </p>
        {/* Specs row */}
        <div className="flex items-center gap-2.5 mt-1.5">
          {listing.bedrooms != null && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <BedDouble className="w-3 h-3" />
              {listing.bedrooms}bd
            </span>
          )}
          {listing.bathrooms != null && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Bath className="w-3 h-3" />
              {listing.bathrooms}ba
            </span>
          )}
          {listing.size_sqm != null && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Maximize2 className="w-3 h-3" />
              {listing.size_sqm}m²
            </span>
          )}
        </div>
        <p className="text-xs font-bold text-primary mt-1">
          {formatPrice(listing.price, listing.currency)}
        </p>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  );
}

// ── ChatMessage ───────────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: ChatMessageData;
  onRetry?: () => void;
}

export function ChatMessage({ message, onRetry }: ChatMessageProps) {
  const isUser = message.role === "user";
  const hasListings = (message.listing_refs?.length ?? 0) > 0;
  const seeAllHref = message.search_filters
    ? buildSearchUrl(message.search_filters)
    : "/find-homes";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isUser
            ? "bg-secondary text-muted-foreground"
            : "bg-primary text-white"
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
      </div>

      {/* Bubble + cards */}
      <div
        className={`flex flex-col gap-2 max-w-[82%] ${isUser ? "items-end" : "items-start"}`}
      >
        {/* Text bubble */}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-white rounded-tr-sm"
              : "bg-secondary text-foreground rounded-tl-sm"
          }`}
        >
          <MessageContent content={message.content} />
        </div>

        {/* Retry button — only on error assistant messages */}
        {!isUser && message.isError && onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline ml-0.5"
          >
            <RotateCcw className="w-3 h-3" />
            Retry
          </button>
        )}

        {/* Proximity notice banner */}
        {message.proximity_notice && (
          <div className="flex items-start gap-2 w-full px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] leading-snug">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{message.proximity_notice}</span>
          </div>
        )}

        {/* Listing cards */}
        {hasListings && (
          <div className="flex flex-col gap-2 w-full">
            {message.listing_refs!.map((listing) => (
              <ListingRefCard key={listing.id} listing={listing} />
            ))}

            {/* See all — carries extracted filters as query params */}
            <Link
              href={seeAllHref}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors"
            >
              See all matching listings
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** Typing indicator shown while AI is responding */
export function TypingIndicator() {
  return (
    <div className="flex gap-2.5 flex-row">
      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
          />
        ))}
      </div>
    </div>
  );
}
