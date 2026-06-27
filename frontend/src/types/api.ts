// API response types — mirror the backend Pydantic schemas exactly

// ── Auth / Profile ──

export interface ApiProfileResponse {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  bio: string | null;
  role: string;
  is_verified_seller: boolean;
  gender: string | null;
  country_code: string | null;
  badges: string[];
  birth_date: string | null;
  age: number | null;
  occupation: string | null;
  lifestyle_preferences: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

// ── Shared types ──

export interface ListingLifestylePreferences {
  gender_preference?: "male" | "female" | null;
  smoking_allowed?: boolean | null;
  pets_allowed?: boolean | null;
  guests_policy?: "flexible" | "rarely" | "never" | null;
  noise_level?: "quiet" | "moderate" | "lively" | null;
  cleanliness?: "very_clean" | "average" | "relaxed" | null;
  sleep_schedule?: "early_bird" | "night_owl" | "flexible" | null;
  occupation_type?: "student" | "professional" | "any" | null;
}

export interface PaymentPlan {
  type: "cash";
  down_payment_pct?: number | null;
  monthly_installment?: number | null;
  years?: number | null;
}

export interface NeighborhoodBrief {
  id: string;
  name: string;
  name_ar: string | null;
  city: string;
  slug: string;
}

// ── Listings ──

export interface ListingBrief {
  id: string;
  title: string;
  location: string;
  price: number;
  currency: string;
  price_period: string;
  property_type: string;
  category: "for_rent" | "for_sale" | "shared_housing";
  images: string[];
  verified: boolean;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  floor_number: number | null;
  neighborhood_id: string | null;
  compound_name: string | null;
  room_type?: "ensuite" | "private" | "shared" | null;
  lifestyle_preferences?: ListingLifestylePreferences | null;
  total_spots?: number | null;
  filled_spots?: number | null;
  utilities_included?: boolean | null;
  available_date?: string | null;
  views_count: number;
  is_new: boolean;
  created_at: string | null;
}

export interface ListingDetail extends ListingBrief {
  owner_id: string;
  agency_id: string | null;
  description: string | null;
  full_address: string | null;
  amenities: string[];
  updated_at: string | null;
  // Location
  neighborhood_id: string | null;
  total_floors: number | null;
  latitude: number | null;
  longitude: number | null;
  // Rental fields (for_rent + shared_housing)
  lease_type: "monthly" | "yearly" | null;
  min_stay_months: number | null;
  // Sale fields (for_sale)
  payment_plan: PaymentPlan | null;
  delivery_date: string | null;
  title_deed_status: "ready" | "off_plan" | "pending" | null;
  // Shared housing fields — present when category === "shared_housing"
  room_type: "ensuite" | "private" | "shared" | null;
  lifestyle_preferences: ListingLifestylePreferences | null;
  total_spots: number | null;
  filled_spots: number | null;
  availability: string | null;
  available_date: string | null;
  furnishing: string | null;
  utilities_included: boolean;
  bathroom_type: string | null;
  private_amenities: string[];
  shared_amenities: string[];
  contact_phone: string | null;
  contact_name: string | null;
}

export interface ListingDetailWithSimilar extends ListingDetail {
  similar_listings: ListingBrief[];
}

/** Alias for plan compatibility — identical to ListingBrief */
export type ApiListingBrief = ListingBrief;

/** Alias for plan compatibility — identical to ListingDetailWithSimilar */
export type ApiListingDetail = ListingDetailWithSimilar;

export interface PaginatedListings {
  listings: ListingBrief[];
  total: number;
  page: number;
  per_page: number;
}

// ── Agencies ──

export interface AgencyBrief {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description?: string | null;
  logo_url: string | null;
  banner_url?: string | null;
  verified: boolean;
  active_projects: number;
  listings_count: number;
}

export interface ApiAgencyDetail extends AgencyBrief {
  description: string | null;
  banner_url: string | null;
  trust_score: number;
  followers_count: number;
  created_at: string | null;
  founded_year: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  city: string | null;
}

export interface PaginatedAgencies {
  agencies: AgencyBrief[];
  total: number;
  page: number;
  per_page: number;
}

// ── Projects ──

export interface ProjectBrief {
  id: string;
  agency_id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  completion_pct: number;
  starting_price: number | null;
  status: string;
}

export interface ApiProjectDetail extends ProjectBrief {
  description: string | null;
  units_total: number | null;
  key_features: string[];
  gallery_images: string[];
  brochure_url: string | null;
  created_at: string | null;
  agency_name: string | null;
  agency_slug: string | null;
  agency_logo: string | null;
  agency_verified: boolean;
}

// ── Blog ──

export interface BlogPostBrief {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  category: string | null;
  author_name: string | null;
  author_avatar: string | null;
  read_time: string | null;
  published_at: string | null;
}

export interface BlogPostDetail extends BlogPostBrief {
  author_role: string | null;
  lead: string | null;
  content: unknown[];
  tags: string[];
  created_at: string | null;
}

export interface PaginatedBlogPosts {
  posts: BlogPostBrief[];
  total: number;
  page: number;
  per_page: number;
}

// ── Dashboard (unified) ──

export interface LikedPropertyBrief {
  id: string;
  listing_id: string;
  title: string;
  location: string;
  price: number;
  price_period: string | null;
  category: "for_rent" | "for_sale" | "shared_housing" | null;
  images: string[];
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  created_at: string | null;
}

export interface ApiDashboardListing {
  id: string;
  title: string;
  location: string;
  full_address?: string | null;
  category?: string | null;
  price: number;
  status: string;
  views_count: number;
  images: string[];
  created_at: string | null;
}

export interface ApiAnalyticsStat {
  label: string;
  value: string;
  trend_percent: number;
  trend_up: boolean;
}

export interface DashboardResponse {
  profile: ApiProfileResponse;
  listings: ApiDashboardListing[];
  listings_count: number;
  active_count: number;
  pending_count: number;
  analytics: ApiAnalyticsStat[];
  liked_properties: LikedPropertyBrief[];
  liked_count: number;
}

// ── Shared Housing (legacy — remove when Task 14 redirect is in place) ──

/** @deprecated Use ListingDetail with category==="shared_housing" instead */
export interface ApiSharedHousingDetail {
  id: string;
  listing_id: string;
  total_spots: number;
  filled_spots: number;
  availability: string;
  available_date: string | null;
  furnishing: string;
  utilities_included: boolean;
  bathroom_type: string;
  private_amenities: string[];
  shared_amenities: string[];
  title: string;
  location: string;
  full_address: string | null;
  price: number;
  currency: string;
  images: string[];
  description: string | null;
  verified: boolean;
  owner_id: string;
}

// ── Universities ──

export interface ApiUniversity {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  logo_url: string | null;
  banner_url: string | null;
  verified: boolean;
  listings_count: number;
  city: string | null;
  type: "public" | "private" | null;
  student_count: number | null;
  accreditation: string | null;
  founded_year: number | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  trust_score: number;
  created_at: string | null;
  listings?: ListingBrief[];
}

export interface PaginatedUniversities {
  universities: ApiUniversity[];
  total: number;
  page: number;
  per_page: number;
}

// ── Subscriptions ──

export interface SubscriptionStatus {
  plan: "free" | "trial" | "basic" | "pro" | "agency";
  status: string | null;
  listing_cap: number;
  active_listings: number;
  ai_quota: number;
  ai_used: number;
  ai_remaining: number;
  trial_used: boolean;
  trial_ends_at: string | null;
  current_period_end: string | null;
}
