// frontend/src/lib/supabase-queries.ts
import { supabase } from "@/lib/supabase";
import type {
  ListingBrief,
  ListingDetailWithSimilar,
  AgencyBrief,
  ApiAgencyDetail,
  ProjectBrief,
  ApiProjectDetail,
  BlogPostBrief,
  BlogPostDetail,
  ApiDashboardListing,
  ApiUniversity,
} from "@/types/api";
import type { UniversityDetail } from "@/types";

// ── Listings ──────────────────────────────────────────────────────────────────

export interface ListingFilters {
  category?: string;
  property_type?: string;
  min_price?: number;
  max_price?: number;
  bedrooms?: number[];
  bathrooms?: number[];
  min_size_sqm?: number;
  max_size_sqm?: number;
  lease_type?: string;
  room_type?: string;
  utilities_included?: boolean;
  amenities?: string[];
  search?: string;
  sort_by?: string;
  page?: number;
  per_page?: number;
  agency_id?: string;
  project_id?: string;
}

// Maps search keywords → exact amenity values stored in DB
const AMENITY_KEYWORDS: Record<string, string> = {
  parking:          "Parking",
  gym:              "Gym",
  fitness:          "Gym",
  security:         "Security",
  guard:            "Security",
  elevator:         "Elevator",
  lift:             "Elevator",
  garden:           "Garden",
  ac:               "Central AC",
  "central ac":     "Central AC",
  "air conditioning": "Central AC",
  balcony:          "Balcony",
  pool:             "Swimming Pool",
  "swimming pool":  "Swimming Pool",
  swim:             "Swimming Pool",
  furnished:        "Furnished",
  rooftop:          "Rooftop",
  "pet friendly":   "Pet Friendly",
  pets:             "Pet Friendly",
  cctv:             "CCTV",
  camera:           "CCTV",
  doorman:          "Doorman",
  concierge:        "Doorman",
};

// Converts "5 million" → 5000000, "500k" → 500000, "3000" → 3000
function parsePriceToken(token: string): number {
  const t = token.toLowerCase().replace(/,/g, "").trim();
  const num = parseFloat(t);
  if (isNaN(num)) return 0;
  if (/million|m\b/.test(t)) return Math.round(num * 1_000_000);
  if (/thousand|k\b/.test(t)) return Math.round(num * 1_000);
  return Math.round(num);
}

const PROPERTY_TYPE_KEYWORDS: Record<string, string> = {
  apartment:      "apartment",
  flat:           "apartment",
  villa:          "villa",
  studio:         "studio",
  duplex:         "duplex",
  penthouse:      "penthouse",
  chalet:         "chalet",
  townhouse:      "townhouse",
  "twin house":   "twin_house",
  "twin-house":   "twin_house",
  office:         "office",
  shop:           "commercial",
  commercial:     "commercial",
  land:           "land",
};

const BEDROOM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5,
};

export function parseSearchQuery(raw: string): {
  text: string;
  minPrice: number | null;
  maxPrice: number | null;
  amenities: string[];
  bedrooms: number | null;
  propertyType: string | null;
  category: string | null;
} {
  let text = raw;
  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  const amenities: string[] = [];
  let bedrooms: number | null = null;
  let propertyType: string | null = null;
  let category: string | null = null;

  // Number token: digits with optional comma, optional suffix (million/m/thousand/k)
  const NUM = String.raw`[\d,]+(?:\.\d+)?(?:\s*(?:million|thousand|[mk]))?`;

  // Price ceiling: "under/below/max/less than 5 million [EGP]"
  text = text.replace(
    new RegExp(String.raw`\b(?:under|below|max|less\s+than|up\s+to)\s+(${NUM})(?:\s*egp)?\b`, "gi"),
    (_, n) => { maxPrice = parsePriceToken(n); return ""; },
  );
  // Price floor: "above/over/min/more than/from/starting 3000 [EGP]"
  text = text.replace(
    new RegExp(String.raw`\b(?:above|over|min|more\s+than|from|starting(?:\s+at)?)\s+(${NUM})(?:\s*egp)?\b`, "gi"),
    (_, n) => { minPrice = parsePriceToken(n); return ""; },
  );
  // Price range: "3000-8000" or "3 million to 8 million [EGP]"
  text = text.replace(
    new RegExp(String.raw`\b(${NUM})\s*(?:to|-)\s*(${NUM})(?:\s*egp)?\b`, "gi"),
    (_, a, b) => {
      minPrice = parsePriceToken(a);
      maxPrice = parsePriceToken(b);
      return "";
    },
  );

  // Category: only when explicitly stated
  if (/\b(rent|rental|renting|for\s+rent)\b/i.test(text)) {
    category = "for_rent";
    text = text.replace(/\b(rent(?:al|ing)?|for\s+rent)\b/gi, "");
  } else if (/\b(buy|buying|purchase|purchasing|for\s+sale|sale)\b/i.test(text)) {
    category = "for_sale";
    text = text.replace(/\b(buy(?:ing)?|purchas(?:e|ing)|for\s+sale|sale)\b/gi, "");
  } else if (/\b(shared?|roommate|housemate|flatmate|sharing)\b/i.test(text)) {
    category = "shared_housing";
    text = text.replace(/\b(shared?|roommate|housemate|flatmate|sharing)\b/gi, "");
  }

  // Property type — multi-word first
  const ptKeys = Object.keys(PROPERTY_TYPE_KEYWORDS).sort((a, b) => b.length - a.length);
  for (const kw of ptKeys) {
    const re = new RegExp(`\\b${kw}\\b`, "gi");
    if (re.test(text)) {
      propertyType = PROPERTY_TYPE_KEYWORDS[kw];
      text = text.replace(re, "");
      break;
    }
  }

  // Bedrooms: "2 bedroom", "2bd", "2-bed", "two bedroom", "2 rooms"
  text = text.replace(
    /\b(\d+|one|two|three|four|five|[١٢٣٤٥])\s*[-]?\s*(?:bed(?:room)?s?|bd|br|غرف(?:ة)?)\b/gi,
    (_, n) => {
      const num = parseInt(n, 10);
      bedrooms = isNaN(num) ? (BEDROOM_WORDS[n.toLowerCase()] ?? null) : num;
      return "";
    },
  );

  // Amenity extraction — multi-word first
  const sortedKeys = Object.keys(AMENITY_KEYWORDS).sort((a, b) => b.length - a.length);
  for (const keyword of sortedKeys) {
    const re = new RegExp(`\\b${keyword}\\b`, "gi");
    if (re.test(text)) {
      const val = AMENITY_KEYWORDS[keyword];
      if (!amenities.includes(val)) amenities.push(val);
      text = text.replace(re, "");
    }
  }

  // Strip filler NL words that add no filter value
  text = text.replace(
    /\b(i(?:'m|\s+am)?|want|need|looking\s+for|find\s+me|show\s+me|a|an|the|in|at|with|and|or|for|nice|good|great|comfortable|ideal|perfect)\b/gi,
    " ",
  );

  return {
    text: text.trim().replace(/\s{2,}/g, " "),
    minPrice,
    maxPrice,
    amenities,
    bedrooms,
    propertyType,
    category,
  };
}

// Generates fuzzy separator variants so "wadi degla" matches "wadi-degla" and vice versa
function searchVariants(text: string): string[] {
  const t = text.toLowerCase().trim();
  return [...new Set([
    t,
    t.replace(/\s+/g, "-"),       // space → hyphen
    t.replace(/-+/g, " "),        // hyphen → space
    t.replace(/[-\s]+/g, ""),     // remove all separators
  ])].filter(Boolean);
}

export async function getListings(filters?: ListingFilters) {
  const page = filters?.page ?? 1;
  const perPage = filters?.per_page ?? 12;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("listings")
    .select(
      "id, title, location, price, currency, price_period, category, property_type, images, verified, status, bedrooms, bathrooms, size_sqm, floor_number, compound_name, views_count, is_new, created_at",
      { count: "exact" }
    )
    .is("deleted_at", null)
    .eq("status", "active");

  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.property_type) query = query.eq("property_type", filters.property_type);
  if (filters?.bedrooms?.length) query = query.in("bedrooms", filters.bedrooms);
  if (filters?.bathrooms?.length) query = query.in("bathrooms", filters.bathrooms);
  if (filters?.min_size_sqm) query = query.gte("size_sqm", filters.min_size_sqm);
  if (filters?.max_size_sqm) query = query.lte("size_sqm", filters.max_size_sqm);
  if (filters?.lease_type) query = query.eq("lease_type", filters.lease_type);
  if (filters?.room_type) query = query.eq("room_type", filters.room_type);
  if (filters?.utilities_included !== undefined) {
    query = query.eq("utilities_included", filters.utilities_included);
  }

  // Explicit price filters from sidebar
  if (filters?.min_price) query = query.gte("price", filters.min_price);
  if (filters?.max_price) query = query.lte("price", filters.max_price);

  // Explicit amenities filter from sidebar
  if (filters?.amenities?.length) query = query.overlaps("amenities", filters.amenities);

  if (filters?.agency_id) query = query.eq("agency_id", filters.agency_id);
  if (filters?.project_id) query = query.eq("project_id", filters.project_id);

  if (filters?.search) {
    const { text, minPrice, maxPrice, amenities, bedrooms, propertyType, category } = parseSearchQuery(filters.search);

    // Parsed price — only apply if not already set by explicit filters
    if (minPrice && !filters.min_price) query = query.gte("price", minPrice);
    if (maxPrice && !filters.max_price) query = query.lte("price", maxPrice);

    // Parsed structural filters — only apply if not already set
    if (bedrooms != null && !filters.bedrooms?.length) query = query.in("bedrooms", [bedrooms]);
    if (propertyType && !filters.property_type) query = query.eq("property_type", propertyType);
    if (category && !filters.category) query = query.eq("category", category);

    // Parsed amenities — merge with sidebar amenities
    if (amenities.length > 0) {
      const merged = [...new Set([...(filters.amenities ?? []), ...amenities])];
      query = query.overlaps("amenities", merged);
    }

    // Remaining text → ilike on title / location / compound_name + agency/project lookup
    if (text) {
      const variants = searchVariants(text);
      // Agency lookup — try all separator variants
      const agencyIds: string[] = [];
      for (const v of variants) {
        const { data: agencyRows } = await supabase
          .from("agencies")
          .select("id")
          .ilike("name", `%${v}%`);
        for (const row of agencyRows ?? []) {
          const r = row as { id: string };
          if (!agencyIds.includes(r.id)) agencyIds.push(r.id);
        }
      }
      // Project lookup — try all separator variants
      const projectIds: string[] = [];
      for (const v of variants) {
        const { data: projectRows } = await supabase
          .from("projects")
          .select("id")
          .ilike("title", `%${v}%`);
        for (const row of projectRows ?? []) {
          const r = row as { id: string };
          if (!projectIds.includes(r.id)) projectIds.push(r.id);
        }
      }
      const orParts: string[] = [];
      for (const col of ["title", "location", "compound_name"]) {
        for (const v of variants) orParts.push(`${col}.ilike.%${v}%`);
      }
      if (agencyIds.length > 0) orParts.push(`agency_id.in.(${agencyIds.join(",")})`);
      if (projectIds.length > 0) orParts.push(`project_id.in.(${projectIds.join(",")})`);
      query = query.or(orParts.join(","));
    }
  }

  const sortMap: Record<string, { col: string; asc: boolean }> = {
    newest:       { col: "created_at", asc: false },
    price_asc:    { col: "price",      asc: true  },
    price_desc:   { col: "price",      asc: false },
    most_viewed:  { col: "views_count",asc: false },
  };
  const sort = sortMap[filters?.sort_by ?? "newest"] ?? sortMap.newest;
  query = query.order(sort.col, { ascending: sort.asc });

  const { data, error, count } = await query.range(from, to);
  const listings = (data ?? []) as ListingBrief[];
  return { listings, total: count ?? 0, page, per_page: perPage, error };
}

export async function getListing(id: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("*, profiles!listings_owner_id_fkey(full_name, avatar_url, phone, whatsapp_number), agencies!listings_agency_id_fkey(name, phone)")
    .eq("id", id)
    .single();

  if (error || !data) return { data: null, error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  const profile = d.profiles as { full_name: string | null; phone: string | null; whatsapp_number: string | null } | null;
  const agency  = d.agencies  as { name: string | null; phone: string | null } | null;
  // Pick the first non-empty value (treats "" / whitespace as missing).
  const firstNonEmpty = (...vals: (string | null | undefined)[]) =>
    vals.map((v) => v?.trim()).find((v) => v) ?? null;
  const listing = {
    ...data,
    similar_listings: [],
    contact_phone: firstNonEmpty(profile?.phone, profile?.whatsapp_number, agency?.phone),
    contact_name:  firstNonEmpty(profile?.full_name, agency?.name),
  } as unknown as ListingDetailWithSimilar;
  return { data: listing, error: null };
}

// ── Agencies ──────────────────────────────────────────────────────────────────

export async function getAgencies(search?: string) {
  let query = supabase
    .from("agencies")
    .select("id, slug, name, logo_url, banner_url, verified, description, projects(count), listings(count)")
    .order("name", { ascending: true });

  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agencies: AgencyBrief[] = ((data ?? []) as any[]).map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    subtitle: null,
    description: a.description ?? null,
    logo_url: a.logo_url ?? null,
    banner_url: a.banner_url ?? null,
    verified: a.verified ?? false,
    active_projects: (a.projects as { count: number }[] | null)?.[0]?.count ?? 0,
    listings_count: (a.listings as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
  return { agencies, error };
}

export async function getAgency(slug: string) {
  const { data: agency, error } = await supabase
    .from("agencies")
    .select("id, slug, name, description, logo_url, banner_url, verified, created_at, phone, email, city, website, founded_year")
    .eq("slug", slug)
    .single();

  if (error || !agency) return { agency: null, projects: [], listings: [], error };

  const [projectsRes, listingsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, agency_id, title, image_url, completion_pct, starting_price, status")
      .eq("agency_id", agency.id)
      .limit(6),
    supabase
      .from("listings")
      .select("id, title, location, price, price_period, images, bedrooms, size_sqm, status")
      .eq("agency_id", agency.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(6),
  ]);

  const subError = projectsRes.error ?? listingsRes.error ?? null;

  const projectCount = projectsRes.data?.length ?? 0;
  const listingCount = listingsRes.data?.length ?? 0;
  const isVerified = agency.verified ?? false;
  const computedTrustScore = Math.min(
    (isVerified ? 40 : 0) +
    Math.min(projectCount * 5, 30) +
    Math.min(listingCount * 2, 30),
    100,
  );

  const apiAgency: ApiAgencyDetail = {
    id: agency.id,
    slug: agency.slug,
    name: agency.name,
    subtitle: null,
    description: agency.description ?? null,
    logo_url: agency.logo_url ?? null,
    banner_url: agency.banner_url ?? null,
    verified: isVerified,
    active_projects: projectCount,
    listings_count: listingCount,
    trust_score: computedTrustScore,
    followers_count: 0,
    created_at: agency.created_at ?? null,
    founded_year: (agency as Record<string, unknown>).founded_year as number | null ?? null,
    phone: agency.phone ?? null,
    email: agency.email ?? null,
    website: agency.website ?? null,
    city: agency.city ?? null,
  };

  const projects: ProjectBrief[] = (projectsRes.data ?? []).map((p) => ({
    id: p.id,
    agency_id: p.agency_id,
    title: p.title,
    subtitle: null,
    image_url: p.image_url ?? null,
    completion_pct: p.completion_pct ?? 0,
    starting_price: p.starting_price ? Number(p.starting_price) : null,
    status: p.status ?? "planned",
  }));

  return { agency: apiAgency, projects, listings: listingsRes.data ?? [], error: subError };
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getProject(id: string) {
  const [projectRes, listingsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("*, agencies!projects_agency_id_fkey(name, slug, logo_url, verified)")
      .eq("id", id)
      .single(),
    supabase
      .from("listings")
      .select("id, title, location, price, price_period, images, bedrooms, bathrooms, size_sqm, property_type, status, category")
      .eq("project_id", id)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (projectRes.error || !projectRes.data) return { data: null, listings: [], error: projectRes.error };

  const data = projectRes.data;
  const agency = (data as Record<string, unknown>).agencies as Record<string, unknown> | null ?? {};
  const project: ApiProjectDetail = {
    id: data.id as string,
    agency_id: data.agency_id as string,
    title: (data as Record<string, unknown>).title as string,
    subtitle: ((data as Record<string, unknown>).description as string | null ?? "").slice(0, 100) || null,
    image_url: (data as Record<string, unknown>).image_url as string | null ?? null,
    completion_pct: (data as Record<string, unknown>).completion_pct as number ?? 0,
    starting_price: (data as Record<string, unknown>).starting_price != null
      ? Number((data as Record<string, unknown>).starting_price)
      : null,
    status: (data as Record<string, unknown>).status as string ?? "planned",
    key_features: ((data as Record<string, unknown>).key_features as string[] | null) ?? [],
    gallery_images: ((data as Record<string, unknown>).gallery_images as string[] | null) ?? [],
    brochure_url: (data as Record<string, unknown>).brochure_url as string | null ?? null,
    description: (data as Record<string, unknown>).description as string | null ?? null,
    units_total: (data as Record<string, unknown>).units_total as number | null ?? null,
    created_at: (data as Record<string, unknown>).created_at as string | null ?? null,
    agency_name: (agency.name as string | null) ?? null,
    agency_slug: (agency.slug as string | null) ?? null,
    agency_logo: (agency.logo_url as string | null) ?? null,
    agency_verified: Boolean(agency.verified),
  };
  return { data: project, listings: listingsRes.data ?? [], error: null };
}

// ── Blog ──────────────────────────────────────────────────────────────────────

export interface BlogFilters {
  category?: string;
  page?: number;
  per_page?: number;
}

export async function getBlogPosts(filters?: BlogFilters) {
  const page = filters?.page ?? 1;
  const perPage = filters?.per_page ?? 20;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("blog_posts")
    .select(
      "id, slug, title, lead, image_url, category, tags, created_at, is_published",
      { count: "exact" }
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (filters?.category) query = query.eq("category", filters.category);

  const { data, error, count } = await query.range(from, to);
  const posts: BlogPostBrief[] = (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.lead ?? null,
    image_url: p.image_url ?? null,
    category: p.category ?? null,
    author_name: null,
    author_avatar: null,
    read_time: null,
    published_at: p.created_at ?? null,
  }));
  return { posts, total: count ?? 0, page, per_page: perPage, error };
}

export async function getBlogPost(slug: string) {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*, profiles!blog_posts_author_id_fkey(full_name, avatar_url)")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error || !data) return { data: null, error };

  const author = (data as Record<string, unknown>).profiles as Record<string, unknown> | null ?? {};
  const post: BlogPostDetail = {
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    subtitle: (data as Record<string, unknown>).lead as string | null ?? null,
    image_url: (data as Record<string, unknown>).image_url as string | null ?? null,
    category: (data as Record<string, unknown>).category as string | null ?? null,
    author_name: (author.full_name as string | null) ?? null,
    author_avatar: (author.avatar_url as string | null) ?? null,
    author_role: null,
    read_time: null,
    published_at: (data as Record<string, unknown>).created_at as string | null ?? null,
    lead: null,
    content: ((data as Record<string, unknown>).content as unknown[]) ?? [],
    tags: ((data as Record<string, unknown>).tags as string[]) ?? [],
    created_at: (data as Record<string, unknown>).created_at as string | null ?? null,
  };
  return { data: post, error: null };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboardListings(userId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, location, full_address, category, price, images, status, views_count, created_at")
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .neq("status", "rejected")
    .order("created_at", { ascending: false });

  const listings: ApiDashboardListing[] = (data ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    location: l.location,
    full_address: l.full_address ?? null,
    category: l.category ?? null,
    price: l.price,
    status: l.status,
    views_count: l.views_count ?? 0,
    images: l.images ?? [],
    created_at: l.created_at ?? null,
  }));

  const active = listings.filter((l) => l.status === "active").length;
  const pending = listings.filter((l) => l.status === "pending").length;

  return { listings, active, pending, error };
}

export async function getLikedListings(ids: string[]) {
  if (!ids.length) return [];
  const { data } = await supabase
    .from("listings")
    .select("id, title, location, price, price_period, category, images, bedrooms, bathrooms, size_sqm, created_at")
    .in("id", ids)
    .is("deleted_at", null);
  return data ?? [];
}

// ── Universities ──────────────────────────────────────────────────────────────

export async function getUniversities(search?: string, limit = 12) {
  let query = supabase
    .from("universities")
    .select(
      "id, slug, name, logo_url, banner_url, verified, city, type, student_count, accreditation, founded_year, description"
    )
    .order("name", { ascending: true })
    .limit(limit);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const universities: ApiUniversity[] = ((data ?? []) as any[]).map((u) => ({
    id: u.id,
    slug: u.slug,
    name: u.name,
    subtitle: u.description ? String(u.description).slice(0, 100) : null,
    logo_url: u.logo_url ?? null,
    banner_url: u.banner_url ?? null,
    verified: u.verified ?? false,
    listings_count: 0,
    city: u.city ?? null,
    type: u.type ?? null,
    student_count: u.student_count ?? null,
    accreditation: u.accreditation ?? null,
    founded_year: u.founded_year ?? null,
    website: null,
    phone: null,
    email: null,
    description: u.description ?? null,
    trust_score: 0,
    created_at: null,
  }));
  return { universities, error };
}

export async function getUniversity(slug: string): Promise<{
  university: UniversityDetail | null;
  listings: Record<string, unknown>[];
  error: unknown;
}> {
  const { data: uni, error } = await supabase
    .from("universities")
    .select(
      "id, slug, name, description, logo_url, banner_url, verified, created_at, phone, email, city, website, founded_year, type, student_count, accreditation"
    )
    .eq("slug", slug)
    .single();

  if (error || !uni) return { university: null, listings: [], error };

  const listingsRes = await supabase
    .from("listings")
    .select("id, title, location, price, price_period, images, bedrooms, size_sqm, status")
    .eq("university_id", uni.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(6);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniAny = uni as any;
  const listingCount = listingsRes.data?.length ?? 0;
  const isVerified = uni.verified ?? false;
  const studentCount = (uniAny.student_count as number | null) ?? null;
  const foundedYear = (uniAny.founded_year as number | null) ?? null;

  const pts =
    (isVerified ? 40 : 0) +
    Math.min(listingCount * 2, 30) +
    (studentCount ? Math.min(Math.floor(studentCount / 1000), 20) : 0) +
    (foundedYear
      ? Math.min(Math.floor((new Date().getFullYear() - foundedYear) / 5), 10)
      : 0);
  const trustScore = Math.min(pts, 100);

  const university: UniversityDetail = {
    id: uni.id,
    slug: uni.slug,
    name: uni.name,
    description: uni.description ?? null,
    logo_url: uni.logo_url ?? null,
    banner_url: uni.banner_url ?? null,
    verified: isVerified,
    listings_count: listingCount,
    trust_score: trustScore,
    city: uni.city ?? null,
    type: (uniAny.type as "public" | "private" | null) ?? null,
    student_count: studentCount,
    accreditation: (uniAny.accreditation as string | null) ?? null,
    founded_year: foundedYear,
    website: uni.website ?? null,
    phone: uni.phone ?? null,
    email: uni.email ?? null,
    created_at: uni.created_at ?? null,
  };

  return {
    university,
    listings: (listingsRes.data ?? []) as Record<string, unknown>[],
    error: listingsRes.error,
  };
}
