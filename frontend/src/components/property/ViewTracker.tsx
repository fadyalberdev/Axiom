"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

const SESSION_KEY = "axiom_viewed_listings";

/** Listing ids already counted this browser session (sessionStorage-backed). */
function alreadyViewed(listingId: string): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (ids.includes(listingId)) return true;
    ids.push(listingId);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(ids));
    return false;
  } catch {
    // sessionStorage unavailable (SSR / privacy mode): fall through and count.
    return false;
  }
}

export default function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    if (alreadyViewed(listingId)) return;
    api.post(`/api/listings/${listingId}/view`).catch(() => {});
  }, [listingId]);

  return null;
}
