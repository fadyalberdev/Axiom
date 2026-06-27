import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Currency ──────────────────────────────────────────────────────────────────

export function formatEGP(amount: number): string {
  return `${amount.toLocaleString("en-EG")} EGP`;
}

export const PLATFORM_FEE_RATE = 0.05;

export function calculatePlatformFee(amount: number) {
  const platformFee = Math.round(amount * PLATFORM_FEE_RATE);
  return {
    platformFee,
    ownerReceives: amount - platformFee,
  };
}

export function formatPrice(
  amount: number,
  period: string,
  currency: string = "EGP"
): string {
  const formatted = amount.toLocaleString("en-EG");
  if (period && period !== "one-time") {
    return `${formatted} ${currency}/${period}`;
  }
  return `${formatted} ${currency}`;
}

export function getListingPriceSuffix(
  category?: string | null,
  pricePeriod?: string | null
): string {
  if (category === "for_sale") return "";
  if (category === "for_rent" || category === "shared_housing") return "/month";
  if (pricePeriod === "monthly" || pricePeriod === "month") return "/month";
  if (pricePeriod) return `/ ${pricePeriod}`;
  return "";
}

export const LISTING_CATEGORY_BADGES: Record<
  string,
  { label: string; className: string }
> = {
  for_rent: {
    label: "For Rent",
    className: "border-emerald-300/30 bg-emerald-300/95 text-emerald-950",
  },
  for_sale: {
    label: "For Sale",
    className: "border-sky-300/30 bg-sky-300/95 text-sky-950",
  },
  shared_housing: {
    label: "Shared",
    className: "border-amber-300/30 bg-amber-300/95 text-amber-950",
  },
};

export function getListingCategoryBadge(category?: string | null) {
  return category ? LISTING_CATEGORY_BADGES[category] ?? null : null;
}

export function formatListingType(type?: string | null): string {
  if (!type) return "Property";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isListingNewWithinWeek(
  createdAt?: string | null,
  now: Date = new Date()
): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const createdTime = created.getTime();
  if (Number.isNaN(createdTime)) return false;
  const ageMs = now.getTime() - createdTime;
  return ageMs >= 0 && ageMs <= 7 * 24 * 60 * 60 * 1000;
}

// ── Date ──────────────────────────────────────────────────────────────────────

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  try {
    const parsed = date instanceof Date ? date : parseISO(date);
    return format(parsed, "dd/MM/yyyy");
  } catch {
    return String(date);
  }
}

export function formatRelativeTime(date: string): string {
  try {
    return formatDistanceToNow(parseISO(date), { addSuffix: true });
  } catch {
    return date;
  }
}

// ── Text ──────────────────────────────────────────────────────────────────────

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Property ──────────────────────────────────────────────────────────────────

export function bedroomsLabel(count: number): string {
  if (count === 0) return "Studio";
  return `${count} ${count === 1 ? "Bedroom" : "Bedrooms"}`;
}

export function propertyTypeLabel(type: string): string {
  switch (type) {
    case "rent":
      return "For Rent";
    case "buy":
      return "For Sale";
    case "shared":
      return "Shared";
    default:
      return type;
  }
}

// ── Location ─────────────────────────────────────────────────────────────────

export function formatLocation(
  location: string,
  fullAddress?: string
): string {
  if (fullAddress) return fullAddress;
  return location;
}
