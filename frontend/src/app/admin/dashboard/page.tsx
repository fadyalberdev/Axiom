"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  approveListing,
  createItem,
  deleteItem,
  getAdminSignedUploadUrl,
  getStats,
  isLoggedIn,
  listItems,
  rejectListing,
  updateItem,
} from "@/lib/admin/api";
import { supabase } from "@/lib/supabase";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTable, { Column } from "@/components/admin/AdminTable";
import AdminModal from "@/components/admin/AdminModal";
import EntityPicker from "@/components/admin/EntityPicker";
import RichTextEditor from "@/components/admin/RichTextEditor";
import AddListingModal from "@/components/dashboard/AddListingModal";
import { formatDate as formatDisplayDate } from "@/lib/utils";
import Image from "next/image";
import {
  Users, Home, Building2, FolderOpen,
  TrendingUp, AlertTriangle, Clock, CheckCircle,
  Search, Plus, RefreshCw, X, ChevronRight, Trash2,
  BedDouble, Upload, Loader2, Sparkles, FileText,
} from "lucide-react";
import type { ElementType } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const STORAGE_BUCKET = "agency-images";

// ── Helpers ────────────────────────────────────────────────────────────────────

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-sky-100 text-sky-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    orange: "bg-orange-100 text-orange-700",
    gray: "bg-slate-100 text-slate-500",
    yellow: "bg-amber-100 text-amber-700",
    purple: "bg-zinc-100 text-zinc-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[color] ?? colors.gray}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color, sub, onClick }: {
  label: string;
  value: number | string;
  icon: ElementType;
  color: string;
  sub?: string;
  onClick?: () => void;
}) {
  const colors: Record<string, { accent: string; iconBg: string; icon: string; value: string }> = {
    blue:   { accent: "bg-sky-500",     iconBg: "bg-sky-50",     icon: "text-sky-600",     value: "text-zinc-950" },
    green:  { accent: "bg-emerald-500", iconBg: "bg-emerald-50", icon: "text-emerald-600", value: "text-zinc-950" },
    purple: { accent: "bg-zinc-500",    iconBg: "bg-zinc-100",    icon: "text-zinc-700",    value: "text-zinc-950" },
    orange: { accent: "bg-orange-500",  iconBg: "bg-orange-50",  icon: "text-orange-600",  value: "text-zinc-950" },
    red:    { accent: "bg-red-500",     iconBg: "bg-red-50",     icon: "text-red-600",     value: "text-zinc-950" },
  };
  const c = colors[color] ?? colors.blue;

  const inner = (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-[1.35rem] border border-zinc-200/80 bg-white p-5 shadow-[0_22px_70px_-45px_rgba(15,23,42,0.55)] ring-1 ring-white transition-[transform,box-shadow] group-hover:-translate-y-0.5 group-hover:shadow-[0_28px_90px_-50px_rgba(15,23,42,0.7)]">
      <div className={`absolute inset-x-0 top-0 h-1 ${c.accent}`} />
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${c.iconBg}`}>
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        <p className={`mt-1 text-3xl font-semibold ${c.value} leading-none`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
      </div>
      {onClick && (
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
      )}
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="group w-full text-left active:scale-[0.99]">
        {inner}
      </button>
    );
  }
  return inner;
}

function formatDate(val: unknown): string {
  if (!val) return "—";
  return formatDisplayDate(String(val)) || "—";
}

function formatPrice(val: unknown): string {
  if (!val) return "—";
  return Number(val).toLocaleString("en-EG") + " EGP";
}

// ── Section configs ────────────────────────────────────────────────────────────

function parseCommaList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "date_ddmmyyyy" | "url" | "textarea" | "select" | "richtext" | "tags" | "json" | "picker" | "image_url" | "image_list" | "file_url";
  options?: string[];
  pickerSection?: "users" | "agencies" | "projects" | "universities";
  /** Key of another field whose value is passed as a filter param to this picker. */
  dependsOn?: string;
  required?: boolean;
  helper?: string;
};

interface SectionConfig {
  title: string;
  apiSection: string;
  columns: Column[];
  searchPlaceholder: string;
  editFields: FieldDef[];
  createFields?: FieldDef[];
  canCreate?: boolean;
  extraFilters?: FieldDef[];
  readOnly?: boolean;
}

const SECTIONS: Record<string, SectionConfig> = {
  users: {
    title: "Users",
    apiSection: "users",
    searchPlaceholder: "Search by name...",
    columns: [
      { key: "full_name", label: "Name" },
      { key: "email", label: "Email" },
      {
        key: "role", label: "Role",
        render: (v) => <Badge color={v === "admin" ? "red" : "blue"}>{String(v ?? "user")}</Badge>,
      },
      { key: "phone", label: "Phone" },
      { key: "whatsapp_number", label: "WhatsApp" },
      { key: "occupation", label: "Occupation" },
      { key: "created_at", label: "Joined", render: (v) => formatDate(v) },
    ],
    editFields: [
      { key: "full_name", label: "Full Name" },
      { key: "phone", label: "Phone" },
      { key: "whatsapp_number", label: "WhatsApp Number" },
      { key: "gender", label: "Gender", type: "select", options: ["male", "female"] },
      { key: "birth_date", label: "Birth Date", type: "date" },
      { key: "occupation", label: "Occupation" },
      { key: "avatar_url", label: "Avatar URL", type: "image_url" },
      { key: "role", label: "Role", type: "select", options: ["user", "admin"] },
      { key: "is_verified_seller", label: "Verified Seller", type: "select", options: ["true", "false"] },
      { key: "bio", label: "Bio", type: "textarea" },
    ],
  },
  listings: {
    title: "Listings",
    apiSection: "listings",
    searchPlaceholder: "Search by title...",
    canCreate: true,
    extraFilters: [
      { key: "category", label: "Category", type: "select", options: ["for_rent", "for_sale", "shared_housing"] },
      { key: "status", label: "Status", type: "select", options: ["active", "pending", "rejected"] },
      { key: "property_type", label: "Type", type: "select", options: ["apartment", "villa", "studio", "duplex", "penthouse", "chalet", "land", "commercial"] },
    ],
    columns: [
      { key: "title", label: "Title" },
      {
        key: "owner_id",
        label: "Owner",
        render: (v, row) => {
          const owner = row.profiles as Record<string, unknown> | null | undefined;
          const name = owner?.full_name || owner?.email;
          return name ? (
            <div className="min-w-0">
              <p className="font-semibold text-zinc-800 truncate">{String(name)}</p>
              <p className="text-xs text-zinc-400 font-mono truncate">{String(v ?? "")}</p>
            </div>
          ) : (
            <Badge color="red">No owner</Badge>
          );
        },
      },
      { key: "price", label: "Price", render: (v) => formatPrice(v) },
      { key: "location", label: "Location" },
      { key: "property_type", label: "Type", render: (v) => <Badge color="purple">{String(v ?? "")}</Badge> },
      {
        key: "category", label: "Category",
        render: (v) => {
          const map: Record<string, string> = { for_rent: "For Rent", for_sale: "For Sale", shared_housing: "Shared" };
          return <Badge color={v === "for_rent" ? "blue" : v === "for_sale" ? "green" : "yellow"}>{map[String(v)] ?? String(v ?? "")}</Badge>;
        },
      },
      { key: "bedrooms", label: "Beds" },
      {
        key: "status", label: "Status",
        render: (v) => {
          const color =
            v === "active" ? "green" :
            v === "pending" ? "yellow" :
            v === "rejected" ? "red" :
            "gray";
          return <Badge color={color}>{String(v ?? "")}</Badge>;
        },
      },
      { key: "created_at", label: "Created", render: (v) => formatDate(v) },
    ],
    editFields: [
      { key: "owner_id", label: "Owner", type: "picker", pickerSection: "users", required: true },
      { key: "title", label: "Title", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "price", label: "Price (EGP)", type: "number", required: true },
      { key: "currency", label: "Currency" },
      { key: "price_period", label: "Price Period", type: "select", options: ["monthly", "yearly"] },
      { key: "full_address", label: "Address", required: true },
      { key: "city", label: "City", required: true },
      { key: "compound_name", label: "Compound / Building" },
      { key: "latitude", label: "Latitude", type: "number" },
      { key: "longitude", label: "Longitude", type: "number" },
      { key: "bedrooms", label: "Bedrooms", type: "number" },
      { key: "bathrooms", label: "Bathrooms", type: "number" },
      { key: "size_sqm", label: "Area (sqm)", type: "number" },
      { key: "floor_number", label: "Floor", type: "number" },
      { key: "total_floors", label: "Total Floors", type: "number" },
      { key: "furnishing", label: "Furnishing", type: "select", options: ["furnished", "semi_furnished", "unfurnished"] },
      { key: "property_type", label: "Type", type: "select", options: ["apartment", "villa", "studio", "duplex", "penthouse", "chalet", "land", "commercial"] },
      { key: "category", label: "Category", type: "select", options: ["for_rent", "for_sale", "shared_housing"] },
      { key: "status", label: "Status", type: "select", options: ["active", "pending", "rejected"] },
      { key: "lease_type", label: "Lease Type", type: "select", options: ["monthly", "yearly"] },
      { key: "min_stay_months", label: "Minimum Stay (months)", type: "number" },
      { key: "available_date", label: "Available Date", type: "date" },
      { key: "title_deed_status", label: "Title Deed Status", type: "select", options: ["ready", "off_plan", "pending"] },
      { key: "delivery_date", label: "Delivery Date", type: "date" },
      { key: "payment_plan", label: "Payment Plan JSON", type: "json", helper: "Example: {\"type\":\"cash\"}" },
      { key: "room_type", label: "Room Type", type: "select", options: ["ensuite", "private", "shared"] },
      { key: "total_spots", label: "Total Spots", type: "number" },
      { key: "filled_spots", label: "Occupied Spots", type: "number" },
      { key: "availability", label: "Availability", type: "select", options: ["available", "limited", "full"] },
      { key: "utilities_included", label: "Utilities Included", type: "select", options: ["true", "false"] },
      { key: "bathroom_type", label: "Bathroom Type", type: "select", options: ["private", "shared", "ensuite"] },
      { key: "lifestyle_preferences", label: "Lifestyle Preferences JSON", type: "json", helper: "Example: {\"gender_preference\":\"female\",\"cleanliness\":\"moderate\"}" },
      { key: "amenities", label: "Amenities", type: "tags", helper: "Comma-separated. Public cards and detail pages use these." },
      { key: "private_amenities", label: "Private Room Features", type: "tags" },
      { key: "shared_amenities", label: "Shared Home Features", type: "tags" },
      { key: "images", label: "Listing Images", type: "image_list", helper: "Upload or paste URLs for each photo. First image is the cover." },
    ],
    createFields: [
      { key: "title", label: "Title", required: true },
      { key: "owner_id", label: "Owner", type: "picker", pickerSection: "users", required: true },
      { key: "agency_id", label: "Agency (optional)", type: "picker", pickerSection: "agencies" },
      { key: "project_id", label: "Project (select Agency first)", type: "picker", pickerSection: "projects", dependsOn: "agency_id" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "price", label: "Price (EGP)", type: "number", required: true },
      { key: "currency", label: "Currency" },
      { key: "price_period", label: "Price Period", type: "select", options: ["monthly", "yearly"] },
      { key: "full_address", label: "Address", required: true },
      { key: "city", label: "City", required: true },
      { key: "compound_name", label: "Compound / Building" },
      { key: "latitude", label: "Latitude", type: "number" },
      { key: "longitude", label: "Longitude", type: "number" },
      { key: "bedrooms", label: "Bedrooms", type: "number" },
      { key: "bathrooms", label: "Bathrooms", type: "number" },
      { key: "size_sqm", label: "Area (sqm)", type: "number" },
      { key: "floor_number", label: "Floor", type: "number" },
      { key: "total_floors", label: "Total Floors", type: "number" },
      { key: "furnishing", label: "Furnishing", type: "select", options: ["furnished", "semi_furnished", "unfurnished"] },
      { key: "property_type", label: "Type", type: "select", options: ["apartment", "villa", "studio", "duplex", "penthouse", "chalet", "land", "commercial"], required: true },
      { key: "category", label: "Category", type: "select", options: ["for_rent", "for_sale", "shared_housing"], required: true },
      { key: "status", label: "Status", type: "select", options: ["active", "pending", "rejected"], helper: "Defaults to active if left blank." },
      { key: "lease_type", label: "Lease Type", type: "select", options: ["monthly", "yearly"] },
      { key: "min_stay_months", label: "Minimum Stay (months)", type: "number" },
      { key: "available_date", label: "Available Date", type: "date" },
      { key: "title_deed_status", label: "Title Deed Status", type: "select", options: ["ready", "off_plan", "pending"] },
      { key: "delivery_date", label: "Delivery Date", type: "date" },
      { key: "payment_plan", label: "Payment Plan JSON", type: "json", helper: "Example: {\"type\":\"cash\"}" },
      { key: "room_type", label: "Room Type", type: "select", options: ["ensuite", "private", "shared"] },
      { key: "total_spots", label: "Total Spots", type: "number" },
      { key: "filled_spots", label: "Occupied Spots", type: "number" },
      { key: "availability", label: "Availability", type: "select", options: ["available", "limited", "full"] },
      { key: "utilities_included", label: "Utilities Included", type: "select", options: ["true", "false"] },
      { key: "bathroom_type", label: "Bathroom Type", type: "select", options: ["private", "shared", "ensuite"] },
      { key: "lifestyle_preferences", label: "Lifestyle Preferences JSON", type: "json", helper: "Example: {\"gender_preference\":\"female\",\"cleanliness\":\"moderate\"}" },
      { key: "amenities", label: "Amenities", type: "tags", helper: "Comma-separated. Public cards and detail pages use these." },
      { key: "private_amenities", label: "Private Room Features", type: "tags" },
      { key: "shared_amenities", label: "Shared Home Features", type: "tags" },
      { key: "images", label: "Listing Images", type: "image_list", helper: "Upload or paste URLs for each photo. First image is the cover." },
    ],
  },
  agencies: {
    title: "Agencies",
    apiSection: "agencies",
    searchPlaceholder: "Search by name…",
    canCreate: true,
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "city", label: "City" },
      {
        key: "verified", label: "Verified",
        render: (v) => <Badge color={v ? "green" : "gray"}>{v ? "Verified" : "Unverified"}</Badge>,
      },
      { key: "created_at", label: "Created", render: (v) => formatDate(v) },
    ],
    editFields: [
      { key: "name", label: "Name", required: true },
      { key: "slug", label: "Slug" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "logo_url", label: "Logo Image URL", type: "image_url" },
      { key: "banner_url", label: "Banner Image URL", type: "image_url" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      { key: "website", label: "Website" },
      { key: "founded_year", label: "Founded Year", type: "number", helper: "e.g. 2005 — sets development history on the agency page." },
      { key: "verified", label: "Verified", type: "select", options: ["true", "false"] },
    ],
    createFields: [
      { key: "name", label: "Name", required: true },
      { key: "owner_id", label: "Owner", type: "picker", pickerSection: "users", required: true },
      { key: "slug", label: "Slug (leave blank to auto-generate)" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "logo_url", label: "Logo Image URL", type: "image_url" },
      { key: "banner_url", label: "Banner Image URL", type: "image_url" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      { key: "website", label: "Website" },
      { key: "founded_year", label: "Founded Year", type: "number", helper: "e.g. 2005 — sets development history on the agency page." },
      { key: "verified", label: "Verified", type: "select", options: ["true", "false"] },
    ],
  },
  projects: {
    title: "Projects",
    apiSection: "projects",
    searchPlaceholder: "Search by name…",
    canCreate: true,
    columns: [
      { key: "title", label: "Project Name" },
      { key: "starting_price", label: "Starting Price", render: (v) => formatPrice(v) },
      { key: "units_total", label: "Units" },
      {
        key: "status", label: "Status",
        render: (v) => <Badge color={v === "completed" ? "green" : v === "in_progress" ? "yellow" : "gray"}>{String(v ?? "")}</Badge>,
      },
      { key: "created_at", label: "Created", render: (v) => formatDate(v) },
    ],
    editFields: [
      { key: "title", label: "Title", required: true },
      { key: "slug", label: "Slug" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "image_url", label: "Cover Image URL", type: "image_url" },
      { key: "starting_price", label: "Starting Price (EGP)", type: "number" },
      { key: "units_total", label: "Total Units", type: "number" },
      { key: "completion_pct", label: "Completion %", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["upcoming", "in_progress", "completed"] },
      { key: "key_features", label: "Key Features", type: "tags", helper: "Comma-separated highlights shown on the project page." },
      { key: "gallery_images", label: "Gallery Images", type: "image_list", helper: "Upload or paste image URLs. Shown in the project's Gallery section." },
      { key: "brochure_url", label: "Brochure (PDF)", type: "file_url", helper: "Upload a PDF. Powers the Download Brochure button on the project page." },
    ],
    createFields: [
      { key: "title", label: "Title", required: true },
      { key: "slug", label: "Slug (leave blank to auto-generate)" },
      { key: "agency_id", label: "Agency", type: "picker", pickerSection: "agencies", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "image_url", label: "Cover Image URL", type: "image_url" },
      { key: "starting_price", label: "Starting Price (EGP)", type: "number" },
      { key: "units_total", label: "Total Units", type: "number" },
      { key: "completion_pct", label: "Completion %", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["upcoming", "in_progress", "completed"] },
      { key: "key_features", label: "Key Features", type: "tags", helper: "Comma-separated highlights shown on the project page." },
      { key: "gallery_images", label: "Gallery Images", type: "image_list", helper: "Upload or paste image URLs. Shown in the project's Gallery section." },
      { key: "brochure_url", label: "Brochure (PDF)", type: "file_url", helper: "Upload a PDF. Powers the Download Brochure button on the project page." },
    ],
  },
  universities: {
    title: "Universities",
    apiSection: "universities",
    searchPlaceholder: "Search by name…",
    canCreate: true,
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      {
        key: "type", label: "Type",
        render: (v) => v ? <Badge color={v === "public" ? "blue" : "purple"}>{String(v)}</Badge> : <span className="text-zinc-400">—</span>,
      },
      {
        key: "verified", label: "Verified",
        render: (v) => <Badge color={v ? "green" : "gray"}>{v ? "Verified" : "Unverified"}</Badge>,
      },
      { key: "created_at", label: "Created", render: (v) => formatDate(v) },
    ],
    editFields: [
      { key: "name", label: "Name", required: true },
      { key: "slug", label: "Slug" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "logo_url", label: "Logo Image URL", type: "image_url" },
      { key: "banner_url", label: "Banner Image URL", type: "image_url" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      { key: "website", label: "Website" },
      { key: "founded_year", label: "Founded Year", type: "number", helper: "e.g. 1950" },
      { key: "type", label: "Type", type: "select", options: ["public", "private"] },
      { key: "student_count", label: "Student Count", type: "number" },
      { key: "accreditation", label: "Accreditation" },
      { key: "verified", label: "Verified", type: "select", options: ["true", "false"] },
    ],
    createFields: [
      { key: "name", label: "Name", required: true },
      { key: "owner_id", label: "Owner", type: "picker", pickerSection: "users", required: true },
      { key: "slug", label: "Slug (leave blank to auto-generate)" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "logo_url", label: "Logo Image URL", type: "image_url" },
      { key: "banner_url", label: "Banner Image URL", type: "image_url" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      { key: "website", label: "Website" },
      { key: "founded_year", label: "Founded Year", type: "number", helper: "e.g. 1950" },
      { key: "type", label: "Type", type: "select", options: ["public", "private"] },
      { key: "student_count", label: "Student Count", type: "number" },
      { key: "accreditation", label: "Accreditation" },
    ],
  },
  blog: {
    title: "Blog Posts",
    apiSection: "blog",
    searchPlaceholder: "Search by title…",
    extraFilters: [{ key: "is_published", label: "Published", type: "select", options: ["true", "false"] }],
    canCreate: true,
    columns: [
      { key: "title", label: "Title" },
      { key: "category", label: "Category" },
      { key: "read_time", label: "Read Time" },
      {
        key: "is_published", label: "Status",
        render: (v) => <Badge color={v ? "green" : "gray"}>{v ? "Published" : "Draft"}</Badge>,
      },
      { key: "published_at", label: "Published", render: (v) => formatDate(v) },
    ],
    editFields: [
      { key: "title", label: "Title", required: true },
      { key: "slug", label: "Slug" },
      { key: "lead", label: "Lead / Summary", type: "textarea", required: true },
      { key: "image_url", label: "Hero Image", type: "image_url" },
      { key: "category", label: "Category", type: "select", options: ["Market Trends", "Renting Tips", "Shared Housing", "Neighborhood Guide", "Buying Guide", "Home Finance", "Design & Living"] },
      { key: "tags", label: "Tags", type: "tags" },
      { key: "read_time", label: "Read Time" },
      { key: "published_at", label: "Publish Date", type: "date_ddmmyyyy" },
      { key: "content", label: "Article Body", type: "richtext", required: true },
      { key: "is_published", label: "Published", type: "select", options: ["true", "false"] },
    ],
    createFields: [
      { key: "title", label: "Title", required: true },
      { key: "slug", label: "Slug" },
      { key: "author_id", label: "Author", type: "picker", pickerSection: "users", required: true },
      { key: "lead", label: "Lead / Summary", type: "textarea", required: true },
      { key: "image_url", label: "Hero Image", type: "image_url" },
      { key: "category", label: "Category", type: "select", options: ["Market Trends", "Renting Tips", "Shared Housing", "Neighborhood Guide", "Buying Guide", "Home Finance", "Design & Living"] },
      { key: "tags", label: "Tags", type: "tags" },
      { key: "read_time", label: "Read Time" },
      { key: "published_at", label: "Publish Date", type: "date_ddmmyyyy" },
      { key: "content", label: "Article Body", type: "richtext", required: true },
      { key: "is_published", label: "Published", type: "select", options: ["true", "false"] },
    ],
  },
  leads: {
    title: "Leads",
    apiSection: "leads",
    searchPlaceholder: "Search by buyer name…",
    readOnly: true,
    extraFilters: [
      { key: "source", label: "Source", type: "select", options: ["whatsapp_click"] },
      { key: "is_billable", label: "Billable", type: "select", options: ["true", "false"] },
    ],
    columns: [
      { key: "contact_name", label: "Buyer Name" },
      { key: "contact_phone", label: "Phone" },
      { key: "listing_title", label: "Listing" },
      { key: "agency_name", label: "Agency" },
      {
        key: "source", label: "Source",
        render: (v) => (
          <Badge color="blue">Contact</Badge>
        ),
      },
      {
        key: "is_billable", label: "Billable",
        render: (v) => <Badge color={v ? "green" : "gray"}>{v ? "Yes" : "No"}</Badge>,
      },
      { key: "created_at", label: "Date", render: (v) => formatDate(v) },
    ],
    editFields: [],
  },
};

// ── Edit/Create Form ───────────────────────────────────────────────────────────

function EntityForm({
  fields,
  initial,
  onSave,
  onCancel,
  loading,
}: {
  fields: FieldDef[];
  initial?: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [formatLoading, setFormatLoading] = useState(false);

  function articleContentToHtml(value: unknown) {
    if (typeof value === "string") return value;
    if (!Array.isArray(value)) return "";

    return value
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        const data = block as Record<string, unknown>;
        if (data.type === "heading") return `<h2>${String(data.text ?? "")}</h2>`;
        if (data.type === "paragraph") return `<p>${String(data.text ?? "")}</p>`;
        if (data.type === "blockquote") return `<blockquote>${String(data.text ?? "")}</blockquote>`;
        if (data.type === "list" || data.type === "takeaways") {
          const items = Array.isArray(data.items) ? data.items : [];
          return `<ul>${items.map((item) => `<li>${String(item)}</li>`).join("")}</ul>`;
        }
        return "";
      })
      .join("");
  }

  function htmlToArticleContent(html: string) {
    if (typeof window === "undefined") return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const blocks: Record<string, unknown>[] = [];

    doc.body.childNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();
      const text = element.textContent?.trim() ?? "";
      if (!text) return;

      if (/^h[1-6]$/.test(tag)) {
        blocks.push({ type: "heading", text });
      } else if (tag === "blockquote") {
        blocks.push({ type: "blockquote", text, attribution: "AXIOM Editorial" });
      } else if (tag === "ul" || tag === "ol") {
        const items = Array.from(element.querySelectorAll("li"))
          .map((item) => item.innerHTML.trim())
          .filter(Boolean);
        if (items.length > 0) blocks.push({ type: "list", items });
      } else {
        blocks.push({ type: "paragraph", text: element.innerHTML.trim() });
      }
    });

    return blocks;
  }

  function formatDateInput(value: unknown) {
    if (!value) return "";
    const raw = String(value);
    if (raw.includes("/") || !/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return String(value);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function parseDateInput(value: unknown) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() !== Number(month) - 1 ||
      date.getDate() !== Number(day)
    ) {
      return null;
    }
    return date.toISOString();
  }

  function autoFormatArticleBody(value: unknown) {
    const html = articleContentToHtml(value);
    if (!html.trim()) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const blocks: Record<string, unknown>[] = [];

    Array.from(doc.body.children).forEach((element, index) => {
      const tag = element.tagName.toLowerCase();
      const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!text) return;

      if (/^h[1-6]$/.test(tag)) {
        blocks.push({ type: "heading", text });
        return;
      }

      if (tag === "blockquote") {
        blocks.push({ type: "blockquote", text, attribution: "AXIOM Editorial" });
        return;
      }

      if (tag === "ul" || tag === "ol") {
        const items = Array.from(element.querySelectorAll("li"))
          .map((item) => item.innerHTML.replace(/\s+/g, " ").trim())
          .filter(Boolean);
        if (items.length > 0) blocks.push({ type: "list", items });
        return;
      }

      const isTypedQuote = /^>\s+/.test(text);
      const isTypedList = /^[-*]\s+/.test(text);
      const cleaned = text.replace(/^>\s+/, "").replace(/^[-*]\s+/, "");
      const looksLikeHeading =
        index > 0 &&
        cleaned.length <= 72 &&
        !cleaned.endsWith(".") &&
        !cleaned.endsWith(",") &&
        !cleaned.includes(": ");

      if (isTypedQuote) {
        blocks.push({ type: "blockquote", text: cleaned, attribution: "AXIOM Editorial" });
      } else if (isTypedList) {
        const previous = blocks[blocks.length - 1];
        if (previous?.type === "list" && Array.isArray(previous.items)) {
          previous.items.push(cleaned);
        } else {
          blocks.push({ type: "list", items: [cleaned] });
        }
      } else if (looksLikeHeading) {
        blocks.push({ type: "heading", text: cleaned });
      } else {
        blocks.push({ type: "paragraph", text: element.innerHTML.trim() });
      }
    });

    return blocks;
  }

  function set(key: string, value: unknown) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Clear any fields that depend on this one
      fields.forEach((fd) => {
        if (fd.dependsOn === key) {
          next[fd.key] = "";
          next[`${fd.key}_label`] = "";
        }
      });
      return next;
    });
  }

  async function handleFileUpload(fieldKey: string, file: File) {
    setUploading((u) => ({ ...u, [fieldKey]: true }));
    setUploadErrors((e) => ({ ...e, [fieldKey]: "" }));
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${fieldKey}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
      set(fieldKey, publicUrl);
    } catch (err) {
      setUploadErrors((e) => ({ ...e, [fieldKey]: err instanceof Error ? err.message : "Upload failed" }));
    } finally {
      setUploading((u) => ({ ...u, [fieldKey]: false }));
    }
  }

  async function handleListImageUpload(fieldKey: string, index: number, file: File) {
    const uploadKey = `${fieldKey}__${index}`;
    setUploading((u) => ({ ...u, [uploadKey]: true }));
    setUploadErrors((e) => ({ ...e, [uploadKey]: "" }));
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${fieldKey}-${Date.now()}-${index}.${ext}`;
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
      setForm((f) => {
        const arr = Array.isArray(f[fieldKey]) ? [...(f[fieldKey] as string[])] : [];
        arr[index] = publicUrl;
        return { ...f, [fieldKey]: arr };
      });
    } catch (err) {
      setUploadErrors((e) => ({ ...e, [uploadKey]: err instanceof Error ? err.message : "Upload failed" }));
    } finally {
      setUploading((u) => ({ ...u, [uploadKey]: false }));
    }
  }

  async function handleFormatWithAI(fieldKey: string) {
    setFormatLoading(true);
    try {
      const html = articleContentToHtml(form[fieldKey]);
      // Extract plain text preserving block boundaries so the AI sees natural line breaks
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const childEls = Array.from(doc.body.children);
      const plainText = childEls.length > 0
        ? childEls.map((el) => el.textContent?.trim() ?? "").filter(Boolean).join("\n\n")
        : (doc.body.textContent?.trim() ?? "");

      if (!plainText) { setFormatLoading(false); return; }

      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${BASE}/api/ai/format-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plainText }),
      });

      if (res.ok) {
        const data = await res.json() as { blocks?: unknown[]; ai_unavailable?: boolean };
        if (Array.isArray(data.blocks) && data.blocks.length > 0) {
          set(fieldKey, data.blocks);
          return;
        }
      }
    } catch {
      // fall through to client-side
    } finally {
      setFormatLoading(false);
    }
    // Fallback: client-side pattern detection
    set(fieldKey, autoFormatArticleBody(form[fieldKey]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.required) {
        const v = form[f.key];
        if (v === undefined || v === null || String(v).trim() === "") {
          newErrors[f.key] = `${f.label} is required`;
        }
      }
      if (f.type === "number" && form[f.key] !== undefined && form[f.key] !== "") {
        if (isNaN(Number(form[f.key]))) {
          newErrors[f.key] = `${f.label} must be a number`;
        }
      }
      if (f.type === "date_ddmmyyyy" && form[f.key]) {
        if (!parseDateInput(form[f.key])) {
          newErrors[f.key] = `${f.label} must be dd/mm/yyyy`;
        }
      }
      if (f.type === "json" && form[f.key]) {
        if (typeof form[f.key] !== "object") {
          try {
            JSON.parse(String(form[f.key]));
          } catch {
            newErrors[f.key] = `${f.label} must be valid JSON`;
          }
        }
      }
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      if (k.endsWith("_label")) continue; // display-only, not a DB column
      const field = fields.find((f) => f.key === k);
      if (field?.type === "image_list") {
        clean[k] = Array.isArray(v) ? (v as string[]).filter(Boolean) : parseCommaList(v);
      } else if (field?.type === "tags") {
        clean[k] = parseCommaList(v);
      } else if (field?.type === "number") {
        clean[k] = v === "" || v === undefined || v === null ? null : Number(v);
      } else if (field?.type === "json") {
        clean[k] = typeof v === "object" ? v : v ? JSON.parse(String(v)) : null;
      } else if (field?.type === "date") {
        clean[k] = v ? String(v) : null;
      } else if (field?.type === "date_ddmmyyyy") {
        clean[k] = v ? parseDateInput(v) : null;
      } else if (v === "true") clean[k] = true;
      else if (v === "false") clean[k] = false;
      else clean[k] = v;
    }
    onSave(clean);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-3xl border border-zinc-300 bg-zinc-950 p-4 text-white shadow-[0_22px_70px_-45px_rgba(15,23,42,0.95)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-300">Related data</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight">Admin record editor</h3>
        <p className="mt-1 text-sm leading-5 text-zinc-400">
          This form only sends the fields configured for this admin section.
        </p>
      </div>
      {fields.map((field) => {
        const fieldError = errors[field.key];
        return (
          <div key={field.key} className="rounded-2xl border border-zinc-300 bg-white p-4 shadow-[0_14px_45px_-38px_rgba(15,23,42,0.55)]">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.helper && (
              <p className="mb-2 text-xs leading-5 text-zinc-500">{field.helper}</p>
            )}
            {field.type === "richtext" ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-slate-500">
                    Use headings, paragraphs, lists, and quotes. The saved output is formatted for the public blog page.
                  </p>
                  <button
                    type="button"
                    disabled={formatLoading}
                    onClick={() => handleFormatWithAI(field.key)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition-[background-color,transform] hover:bg-orange-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {formatLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {formatLoading ? "Formatting…" : "Format body"}
                  </button>
                </div>
                <RichTextEditor
                  value={articleContentToHtml(form[field.key])}
                  onChange={(html) => set(field.key, htmlToArticleContent(html))}
                />
              </div>
            ) : field.type === "image_url" ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => set(field.key, e.target.value)}
                    placeholder="https://..."
                    className={`flex-1 px-3 py-2.5 rounded-lg border bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition placeholder:text-zinc-500 ${fieldError ? "border-red-400" : "border-slate-200"}`}
                  />
                  <label className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-semibold cursor-pointer transition ${uploading[field.key] ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"}`}>
                    {uploading[field.key] ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{uploading[field.key] ? "Uploading…" : "Upload"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading[field.key]}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(field.key, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {uploadErrors[field.key] && (
                  <p className="text-xs text-red-500">{uploadErrors[field.key]}</p>
                )}
                {String(form[field.key] ?? "").startsWith("http") && (
                  <div className="relative h-24 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <Image
                      src={String(form[field.key])}
                      alt="Preview"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                )}
              </div>
            ) : field.type === "file_url" ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => set(field.key, e.target.value)}
                    placeholder="https://… .pdf"
                    className={`flex-1 px-3 py-2.5 rounded-lg border bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition placeholder:text-zinc-500 ${fieldError ? "border-red-400" : "border-slate-200"}`}
                  />
                  <label className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-semibold cursor-pointer transition ${uploading[field.key] ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"}`}>
                    {uploading[field.key] ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{uploading[field.key] ? "Uploading…" : "Upload PDF"}</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={uploading[field.key]}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(field.key, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {uploadErrors[field.key] && (
                  <p className="text-xs text-red-500">{uploadErrors[field.key]}</p>
                )}
                {String(form[field.key] ?? "").startsWith("http") && (
                  <a
                    href={String(form[field.key])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5" /> View current file
                  </a>
                )}
              </div>
            ) : field.type === "picker" && field.pickerSection ? (
              <EntityPicker
                value={String(form[field.key] ?? "")}
                onChange={(id, label) => {
                  set(field.key, id);
                  setForm((f) => ({ ...f, [`${field.key}_label`]: label }));
                }}
                section={field.pickerSection}
                placeholder={`Search ${field.pickerSection}…`}
                displayValue={String(form[`${field.key}_label`] ?? "")}
                extraParams={
                  field.dependsOn
                    ? { [field.dependsOn]: String(form[field.dependsOn] ?? "") }
                    : undefined
                }
                disabled={field.dependsOn ? !form[field.dependsOn] : false}
              />
            ) : field.type === "textarea" ? (
              <textarea
                value={String(form[field.key] ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
                rows={3}
                className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 resize-none transition placeholder:text-zinc-500 ${fieldError ? "border-red-400" : "border-slate-200"}`}
              />
            ) : field.type === "json" ? (
              <textarea
                value={
                  typeof form[field.key] === "object" && form[field.key] !== null
                    ? JSON.stringify(form[field.key], null, 2)
                    : String(form[field.key] ?? "")
                }
                onChange={(e) => set(field.key, e.target.value)}
                rows={4}
                placeholder='{"type":"cash"}'
                className={`w-full px-3 py-2.5 rounded-lg border bg-white font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 resize-y transition placeholder:text-zinc-500 ${fieldError ? "border-red-400" : "border-slate-200"}`}
              />
            ) : field.type === "image_list" ? (
              <div className="space-y-3">
                {(Array.isArray(form[field.key]) ? (form[field.key] as string[]) : []).map((url, idx) => {
                  const uploadKey = `${field.key}__${idx}`;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex gap-2 items-center">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => {
                            setForm((f) => {
                              const arr = [...(Array.isArray(f[field.key]) ? (f[field.key] as string[]) : [])];
                              arr[idx] = e.target.value;
                              return { ...f, [field.key]: arr };
                            });
                          }}
                          placeholder="https://..."
                          className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 bg-zinc-50 text-sm font-medium text-zinc-950 focus:outline-none focus:ring-2 focus:ring-orange-200"
                        />
                        <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold cursor-pointer transition ${uploading[uploadKey] ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"}`}>
                          {uploading[uploadKey] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <span>{uploading[uploadKey] ? "…" : "Upload"}</span>
                          <input type="file" accept="image/*" className="hidden" disabled={uploading[uploadKey]}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleListImageUpload(field.key, idx, f); e.target.value = ""; }}
                          />
                        </label>
                        <button type="button" onClick={() => setForm((f) => { const arr = (Array.isArray(f[field.key]) ? (f[field.key] as string[]) : []).filter((_, i) => i !== idx); return { ...f, [field.key]: arr }; })}
                          className="px-2 py-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-300 transition text-sm font-bold">✕</button>
                      </div>
                      {uploadErrors[uploadKey] && <p className="text-xs text-red-500">{uploadErrors[uploadKey]}</p>}
                      {url.startsWith("http") && (
                        <div className="relative h-20 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                          <Image src={url} alt={`Image ${idx + 1}`} fill className="object-contain" unoptimized />
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button"
                  onClick={() => setForm((f) => ({ ...f, [field.key]: [...(Array.isArray(f[field.key]) ? (f[field.key] as string[]) : []), ""] }))}
                  className="w-full py-2 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-orange-400 hover:text-orange-700 text-sm font-semibold transition">
                  + Add Image
                </button>
              </div>
            ) : field.type === "tags" ? (
              <input
                type="text"
                value={Array.isArray(form[field.key]) ? (form[field.key] as unknown[]).join(", ") : String(form[field.key] ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder="rent, cairo, market update"
                className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition placeholder:text-zinc-500 ${fieldError ? "border-red-400" : "border-slate-200"}`}
              />
            ) : field.type === "select" ? (
              <select
                value={String(form[field.key] ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition ${fieldError ? "border-red-400" : "border-slate-200"}`}
              >
                <option value="">— Select —</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === "date_ddmmyyyy" ? "text" : field.type ?? "text"}
                value={field.type === "date_ddmmyyyy" ? formatDateInput(form[field.key]) : String(form[field.key] ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.type === "date_ddmmyyyy" ? "dd/mm/yyyy" : undefined}
                className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition placeholder:text-zinc-500 ${fieldError ? "border-red-400" : "border-slate-200"}`}
              />
            )}
            {fieldError && (
              <p className="text-xs text-red-500 mt-1">{fieldError}</p>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-3 border-t border-slate-100 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition"
        >
          {loading ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ── Section View ───────────────────────────────────────────────────────────────

type AdminListingCategory = "for_rent" | "for_sale" | "shared_housing";

const ADMIN_LISTING_CATEGORIES: { value: AdminListingCategory; label: string }[] = [
  { value: "for_rent", label: "For Rent" },
  { value: "for_sale", label: "For Sale" },
  { value: "shared_housing", label: "Shared Housing" },
];

const ADMIN_LISTING_PROPERTY_TYPES = [
  "apartment",
  "villa",
  "studio",
  "duplex",
  "penthouse",
  "townhouse",
  "chalet",
  "office",
  "commercial",
  "land",
] as const;

const ADMIN_TOTAL_FLOORS_TYPES = new Set([
  "villa",
  "duplex",
  "townhouse",
  "penthouse",
  "chalet",
  "office",
  "commercial",
]);

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function asBoolSelect(value: unknown) {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

function AdminListingEditForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const initialAgency = initial.agencies as Record<string, unknown> | null | undefined;
  const initialProject = initial.projects as Record<string, unknown> | null | undefined;
  const initialUniversity = initial.universities as Record<string, unknown> | null | undefined;
  const initialOwner = initial.profiles as Record<string, unknown> | null | undefined;
  const [form, setForm] = useState<Record<string, unknown>>({
    ...initial,
    category: asText(initial.category || "for_rent"),
    property_type: asText(initial.property_type || "apartment"),
    status: asText(initial.status || "pending"),
    price_period: asText(initial.price_period || ""),
    lease_type: asText(initial.lease_type || ""),
    title_deed_status: asText(initial.title_deed_status || "ready"),
    utilities_included: asBoolSelect(initial.utilities_included),
    agency_id_label: asText(initialAgency?.name),
    project_id_label: asText(initialProject?.title),
    university_id_label: asText(initialUniversity?.name),
    owner_id_label: asText(initialOwner?.full_name || initialOwner?.email),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingImage, setUploadingImage] = useState<Record<number, boolean>>({});
  const [uploadError, setUploadError] = useState("");

  const category = (form.category as AdminListingCategory) || "for_rent";
  const propertyType = asText(form.property_type);
  const showSaleDeliveryDate = category === "for_sale" && asText(form.title_deed_status) !== "ready";
  const showTotalFloors = category === "for_sale" && ADMIN_TOTAL_FLOORS_TYPES.has(propertyType);
  const isRentLike = category === "for_rent" || category === "shared_housing";
  const isShared = category === "shared_housing";

  function setField(key: string, value: unknown) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "category") {
        if (value !== "for_sale") {
          next.title_deed_status = "";
          next.delivery_date = "";
          next.payment_plan = null;
        } else {
          next.title_deed_status = next.title_deed_status || "ready";
          next.lease_type = "";
          next.min_stay_months = null;
          next.available_date = null;
        }
        if (value !== "shared_housing") {
          next.room_type = "";
          next.total_spots = null;
          next.filled_spots = null;
          next.availability = "";
          next.utilities_included = "";
          next.bathroom_type = "";
          next.private_amenities = [];
          next.shared_amenities = [];
          next.lifestyle_preferences = null;
        }
      }
      if (key === "title_deed_status" && value === "ready") next.delivery_date = "";
      if (key === "property_type" && !ADMIN_TOTAL_FLOORS_TYPES.has(String(value))) next.total_floors = null;
      return next;
    });
  }

  function toNumber(value: unknown) {
    return value === "" || value === null || value === undefined ? null : Number(value);
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!asText(form.owner_id).trim()) nextErrors.owner_id = "Owner is required";
    if (!asText(form.title).trim()) nextErrors.title = "Title is required";
    if (!asText(form.price).trim() || Number(form.price) <= 0) nextErrors.price = "Enter a valid price";
    if (!asText(form.full_address || form.location).trim()) nextErrors.full_address = "Address is required";
    if (!asText(form.city).trim()) nextErrors.city = "City is required";
    if (isRentLike && !asText(form.available_date).trim()) nextErrors.available_date = "Available date is required";
    if (category === "for_sale" && !asText(form.title_deed_status).trim()) nextErrors.title_deed_status = "Title deed is required";
    if (isShared && !asText(form.room_type).trim()) nextErrors.room_type = "Room type is required";
    if (isShared && !asText(form.bathroom_type).trim()) nextErrors.bathroom_type = "Bathroom type is required";
    if (isShared) {
      const totalSpots = toNumber(form.total_spots);
      const filledSpots = toNumber(form.filled_spots) ?? 0;
      if (totalSpots !== null && (filledSpots < 0 || filledSpots > totalSpots)) {
        nextErrors.filled_spots = "Occupied spots must be between 0 and total spots";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const privateAmenities = parseCommaList(form.private_amenities);
    const sharedAmenities = parseCommaList(form.shared_amenities);
    const amenities = isShared
      ? Array.from(new Set([...privateAmenities, ...sharedAmenities]))
      : parseCommaList(form.amenities);

    onSave({
      owner_id: asText(form.owner_id) || null,
      title: asText(form.title).trim(),
      description: asText(form.description),
      status: asText(form.status || "pending"),
      category,
      property_type: propertyType,
      price: Number(form.price),
      currency: asText(form.currency || "EGP"),
      full_address: asText(form.full_address || form.location),
      location: asText(form.full_address || form.location),
      city: asText(form.city || form.location || form.full_address),
      compound_name: asText(form.compound_name) || null,
      agency_id: asText(form.agency_id) || null,
      project_id: asText(form.project_id) || null,
      university_id: asText(form.university_id) || null,
      bedrooms: toNumber(form.bedrooms),
      bathrooms: toNumber(form.bathrooms),
      size_sqm: toNumber(form.size_sqm),
      floor_number: toNumber(form.floor_number),
      total_floors: showTotalFloors ? toNumber(form.total_floors) : null,
      furnishing: asText(form.furnishing) || null,
      price_period: isRentLike ? asText(form.price_period || "monthly") : null,
      lease_type: isRentLike ? asText(form.lease_type || "monthly") : null,
      min_stay_months: isRentLike ? toNumber(form.min_stay_months) : null,
      available_date: isRentLike ? asText(form.available_date) || null : null,
      title_deed_status: category === "for_sale" ? asText(form.title_deed_status || "ready") : null,
      delivery_date: showSaleDeliveryDate ? asText(form.delivery_date) || null : null,
      payment_plan: category === "for_sale" ? form.payment_plan || { type: "cash" } : null,
      room_type: isShared ? asText(form.room_type) || null : null,
      total_spots: isShared ? toNumber(form.total_spots) : null,
      filled_spots: isShared ? (toNumber(form.filled_spots) ?? 0) : null,
      availability: isShared ? asText(form.availability || "available") : null,
      utilities_included: isShared ? form.utilities_included === "true" : null,
      bathroom_type: isShared ? asText(form.bathroom_type) || null : null,
      lifestyle_preferences: isShared ? form.lifestyle_preferences || null : null,
      amenities,
      private_amenities: isShared ? privateAmenities : [],
      shared_amenities: isShared ? sharedAmenities : [],
      images: Array.isArray(form.images) ? (form.images as string[]).filter(Boolean) : parseCommaList(form.images),
    });
  }

  async function uploadListingImage(index: number, file: File) {
    setUploadingImage((prev) => ({ ...prev, [index]: true }));
    setUploadError("");
    try {
      const { upload_url, public_url } = await getAdminSignedUploadUrl("listing-images", file.name);
      await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      setForm((prev) => {
        const images = parseCommaList(prev.images);
        images[index] = public_url;
        return { ...prev, images };
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploadingImage((prev) => ({ ...prev, [index]: false }));
    }
  }

  const inputClass = "w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-950 outline-none transition placeholder:text-zinc-500 hover:border-zinc-400 focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-200";
  const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-700";
  const sectionClass = "rounded-3xl border border-zinc-300 bg-white p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.65)]";

  function FieldShell({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
      <div>
        <label className={labelClass}>{label}</label>
        {children}
        {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-3xl border border-zinc-300 bg-zinc-950 p-4 text-white shadow-[0_22px_70px_-45px_rgba(15,23,42,0.95)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600">Listing editor</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">{asText(form.title) || "Untitled listing"}</h3>
            <p className="mt-1 text-sm text-zinc-400">Only fields related to this category are shown.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ADMIN_LISTING_CATEGORIES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setField("category", item.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-[background-color,color,transform] active:scale-[0.98] ${
                  category === item.value
                    ? "bg-orange-600 text-white"
                    : "border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <FieldShell label="Owner" error={errors.owner_id}>
          <EntityPicker
            value={asText(form.owner_id)}
            displayValue={asText(form.owner_id_label)}
            section="users"
            placeholder="Search users..."
            onChange={(id, label) => {
              setField("owner_id", id);
              setForm((prev) => ({ ...prev, owner_id_label: label }));
            }}
          />
        </FieldShell>
        <FieldShell label="Status">
          <select value={asText(form.status)} onChange={(e) => setField("status", e.target.value)} className={inputClass}>
            {["active", "pending", "rejected"].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </FieldShell>
        <FieldShell label="Agency">
          <EntityPicker
            value={asText(form.agency_id)}
            displayValue={asText(form.agency_id_label)}
            section="agencies"
            placeholder="Search agencies..."
            onChange={(id, label) => {
              setField("agency_id", id);
              setForm((prev) => ({ ...prev, agency_id_label: label, project_id: "", project_id_label: "" }));
            }}
          />
        </FieldShell>
        <FieldShell label="Project">
          <EntityPicker
            value={asText(form.project_id)}
            displayValue={asText(form.project_id_label)}
            section="projects"
            placeholder={form.agency_id ? "Search projects..." : "Choose agency first"}
            disabled={!form.agency_id}
            extraParams={form.agency_id ? { agency_id: asText(form.agency_id) } : undefined}
            onChange={(id, label) => {
              setField("project_id", id);
              setForm((prev) => ({ ...prev, project_id_label: label }));
            }}
          />
        </FieldShell>
        <FieldShell label="University">
          <EntityPicker
            value={asText(form.university_id)}
            displayValue={asText(form.university_id_label)}
            section="universities"
            placeholder="Search universities..."
            onChange={(id, label) => {
              setField("university_id", id);
              setForm((prev) => ({ ...prev, university_id_label: label }));
            }}
          />
        </FieldShell>
      </section>

      <section className={sectionClass}>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Public details</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FieldShell label="Title" error={errors.title}>
            <input value={asText(form.title)} onChange={(e) => setField("title", e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="Property Type">
            <select value={propertyType} onChange={(e) => setField("property_type", e.target.value)} className={inputClass}>
              {ADMIN_LISTING_PROPERTY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </FieldShell>
          <div className="md:col-span-2">
            <FieldShell label="Description">
              <textarea value={asText(form.description)} onChange={(e) => setField("description", e.target.value)} rows={4} className={`${inputClass} resize-y`} />
            </FieldShell>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Price and location</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FieldShell label="Price" error={errors.price}>
            <input type="number" value={asText(form.price)} onChange={(e) => setField("price", e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="Currency">
            <input value={asText(form.currency || "EGP")} onChange={(e) => setField("currency", e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="City" error={errors.city}>
            <input value={asText(form.city)} onChange={(e) => setField("city", e.target.value)} className={inputClass} />
          </FieldShell>
          <div className="md:col-span-2">
            <FieldShell label="Address" error={errors.full_address}>
              <input value={asText(form.full_address || form.location)} onChange={(e) => setField("full_address", e.target.value)} className={inputClass} />
            </FieldShell>
          </div>
          <FieldShell label="Compound / Building">
            <input value={asText(form.compound_name)} onChange={(e) => setField("compound_name", e.target.value)} className={inputClass} />
          </FieldShell>
        </div>
      </section>

      <section className={sectionClass}>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Property specs</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {["bedrooms", "bathrooms", "size_sqm", "floor_number"].map((key) => (
            <FieldShell key={key} label={key.replace("_", " ")}>
              <input type="number" value={asText(form[key])} onChange={(e) => setField(key, e.target.value)} className={inputClass} />
            </FieldShell>
          ))}
          <FieldShell label="Furnishing">
            <select value={asText(form.furnishing)} onChange={(e) => setField("furnishing", e.target.value)} className={inputClass}>
              <option value="">Select</option>
              <option value="furnished">furnished</option>
              <option value="semi_furnished">semi_furnished</option>
              <option value="unfurnished">unfurnished</option>
            </select>
          </FieldShell>
          {showTotalFloors && (
            <FieldShell label="Total Floors">
              <input type="number" value={asText(form.total_floors)} onChange={(e) => setField("total_floors", e.target.value)} className={inputClass} />
            </FieldShell>
          )}
        </div>
      </section>

      {isRentLike && (
        <section className={sectionClass}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{isShared ? "Shared housing terms" : "Rental terms"}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FieldShell label="Price Period">
              <select value={asText(form.price_period || "monthly")} onChange={(e) => setField("price_period", e.target.value)} className={inputClass}>
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
              </select>
            </FieldShell>
            <FieldShell label="Lease Type">
              <select value={asText(form.lease_type || "monthly")} onChange={(e) => setField("lease_type", e.target.value)} className={inputClass}>
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
              </select>
            </FieldShell>
            <FieldShell label="Available Date" error={errors.available_date}>
              <input type="date" value={asText(form.available_date)} onChange={(e) => setField("available_date", e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Minimum Stay Months">
              <input type="number" value={asText(form.min_stay_months)} onChange={(e) => setField("min_stay_months", e.target.value)} className={inputClass} />
            </FieldShell>
          </div>
        </section>
      )}

      {category === "for_sale" && (
        <section className={sectionClass}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sale details</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FieldShell label="Title Deed" error={errors.title_deed_status}>
              <select value={asText(form.title_deed_status || "ready")} onChange={(e) => setField("title_deed_status", e.target.value)} className={inputClass}>
                <option value="ready">ready</option>
                <option value="off_plan">off_plan</option>
                <option value="pending">pending</option>
              </select>
            </FieldShell>
            {showSaleDeliveryDate && (
              <FieldShell label="Delivery Date">
                <input type="date" value={asText(form.delivery_date)} onChange={(e) => setField("delivery_date", e.target.value)} className={inputClass} />
              </FieldShell>
            )}
          </div>
        </section>
      )}

      {isShared && (
        <section className={sectionClass}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Roommate matching</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FieldShell label="Room Type" error={errors.room_type}>
              <select value={asText(form.room_type)} onChange={(e) => setField("room_type", e.target.value)} className={inputClass}>
                <option value="">Select</option>
                <option value="private">private</option>
                <option value="ensuite">ensuite</option>
                <option value="shared">shared</option>
              </select>
            </FieldShell>
            <FieldShell label="Bathroom Type" error={errors.bathroom_type}>
              <select value={asText(form.bathroom_type)} onChange={(e) => setField("bathroom_type", e.target.value)} className={inputClass}>
                <option value="">Select</option>
                <option value="private">private</option>
                <option value="shared">shared</option>
                <option value="ensuite">ensuite</option>
              </select>
            </FieldShell>
            <FieldShell label="Total Spots">
              <input type="number" value={asText(form.total_spots)} onChange={(e) => setField("total_spots", e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Occupied Spots" error={errors.filled_spots}>
              <input type="number" value={asText(form.filled_spots)} onChange={(e) => setField("filled_spots", e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Availability">
              <select value={asText(form.availability || "available")} onChange={(e) => setField("availability", e.target.value)} className={inputClass}>
                <option value="available">available</option>
                <option value="limited">limited</option>
                <option value="full">full</option>
              </select>
            </FieldShell>
            <FieldShell label="Utilities Included">
              <select value={asText(form.utilities_included)} onChange={(e) => setField("utilities_included", e.target.value)} className={inputClass}>
                <option value="">Select</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </FieldShell>
            <FieldShell label="Private Features">
              <input value={parseCommaList(form.private_amenities).join(", ")} onChange={(e) => setField("private_amenities", e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Shared Features">
              <input value={parseCommaList(form.shared_amenities).join(", ")} onChange={(e) => setField("shared_amenities", e.target.value)} className={inputClass} />
            </FieldShell>
          </div>
        </section>
      )}

      <section className={sectionClass}>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Amenities and media</p>
        <div className="grid grid-cols-1 gap-4">
          {!isShared && (
            <FieldShell label="Amenities">
              <input value={parseCommaList(form.amenities).join(", ")} onChange={(e) => setField("amenities", e.target.value)} className={inputClass} />
            </FieldShell>
          )}
          <FieldShell label="Images">
            <div className="space-y-3">
              {parseCommaList(form.images).map((url, index) => (
                <div key={`${url}-${index}`} className="rounded-2xl border border-zinc-300 bg-zinc-50 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center">
                    <div className="relative h-24 overflow-hidden rounded-xl border border-zinc-300 bg-white">
                      {url ? (
                        <Image src={url} alt={`Listing image ${index + 1}`} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-semibold text-zinc-500">
                          No image
                        </div>
                      )}
                    </div>
                    <input
                      value={url}
                      onChange={(e) => {
                        const images = parseCommaList(form.images);
                        images[index] = e.target.value;
                        setField("images", images);
                      }}
                      placeholder="https://..."
                      className={inputClass}
                    />
                    <div className="flex gap-2 md:flex-col">
                      <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        uploadingImage[index]
                          ? "border-zinc-300 bg-zinc-200 text-zinc-500"
                          : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 active:scale-[0.98]"
                      }`}>
                        {uploadingImage[index] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploadingImage[index] ? "Uploading" : "Upload"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingImage[index]}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadListingImage(index, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const images = parseCommaList(form.images).filter((_, imageIndex) => imageIndex !== index);
                          setField("images", images);
                        }}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 active:scale-[0.98]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {parseCommaList(form.images).length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm font-medium text-zinc-600">
                  No listing photos yet.
                </div>
              )}
              {uploadError && <p className="text-sm font-medium text-red-600">{uploadError}</p>}
              <button
                type="button"
                onClick={() => setField("images", [...parseCommaList(form.images), ""])}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98]"
              >
                <Upload className="h-4 w-4" />
                Add image slot
              </button>
            </div>
          </FieldShell>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-6 -mb-5 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur-sm">
        <button type="button" onClick={onCancel} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Saving..." : "Save listing"}
        </button>
      </div>
    </form>
  );
}

function formatRecordLabel(key: string, config: SectionConfig) {
  const field = [...config.columns, ...config.editFields, ...(config.createFields ?? [])].find((item) => item.key === key);
  return field?.label ?? key.replace(/_/g, " ");
}

function renderDetailValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return <span className="text-zinc-400">No value</span>;
  if (key.includes("image") || key.includes("logo") || key === "images") {
    const urls = Array.isArray(value) ? value.map(String).filter(Boolean) : parseCommaList(value);
    if (urls.length > 0) {
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {urls.slice(0, 6).map((url, index) => (
            <div key={`${url}-${index}`} className="relative aspect-video overflow-hidden rounded-xl border border-zinc-300 bg-zinc-100">
              <Image src={url} alt={`${key} ${index + 1}`} fill className="object-cover" unoptimized />
            </div>
          ))}
        </div>
      );
    }
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-400">Empty</span>;
    if (value.every((item) => typeof item !== "object")) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, index) => (
            <span key={`${String(item)}-${index}`} className="rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
              {String(item)}
            </span>
          ))}
        </div>
      );
    }
  }
  if (typeof value === "object") {
    return (
      <pre className="max-h-44 overflow-auto rounded-xl border border-zinc-300 bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  if (typeof value === "boolean") {
    return <Badge color={value ? "green" : "gray"}>{value ? "Yes" : "No"}</Badge>;
  }
  return <span className="break-words text-sm font-medium text-zinc-900">{String(value)}</span>;
}

function AdminRecordDetails({
  row,
  config,
}: {
  row: Record<string, unknown>;
  config: SectionConfig;
}) {
  const title = String(row.title ?? row.name ?? row.full_name ?? row.email ?? row.id ?? config.title);
  const subtitle = String(row.category ?? row.status ?? row.role ?? row.email ?? config.title);
  const orderedKeys = Array.from(new Set([
    ...config.columns.map((column) => column.key),
    ...config.editFields.map((field) => field.key),
    ...(config.createFields ?? []).map((field) => field.key),
    "id",
    "created_at",
    "updated_at",
  ])).filter((key) => row[key] !== undefined && key !== "profiles" && key !== "agencies" && key !== "projects");

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-zinc-300 bg-zinc-950 p-5 text-white shadow-[0_22px_70px_-45px_rgba(15,23,42,0.95)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-300">Live record</p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {orderedKeys.map((key) => (
          <div
            key={key}
            className={`rounded-2xl border border-zinc-300 bg-white p-4 shadow-[0_14px_45px_-38px_rgba(15,23,42,0.55)] ${
              key === "description" || key === "content" || key === "images" ? "md:col-span-2" : ""
            }`}
          >
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-600">{formatRecordLabel(key, config)}</p>
            {renderDetailValue(key, row[key])}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionView({
  sectionId,
  initialFilters = {},
}: {
  sectionId: string;
  initialFilters?: Record<string, string>;
}) {
  const config = SECTIONS[sectionId];
  const isListingsSection = sectionId === "listings";
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [viewRow, setViewRow] = useState<Record<string, unknown> | null>(null);
  const [adminListingMeta, setAdminListingMeta] = useState({
    owner_id: "",
    owner_label: "",
    agency_id: "",
    agency_label: "",
    project_id: "",
    project_label: "",
    university_id: "",
    university_label: "",
    status: "active",
  });

  function resetAdminListingMeta() {
    setAdminListingMeta({
      owner_id: "",
      owner_label: "",
      agency_id: "",
      agency_label: "",
      project_id: "",
      project_label: "",
      university_id: "",
      university_label: "",
      status: "active",
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { page, per_page: 15 };
      if (search) params.search = search;
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await listItems<Record<string, unknown>>(config.apiSection, params);
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [config.apiSection, page, search, filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setFilters(initialFilters);
    setPage(1);
  }, [sectionId, initialFilters]);

  useEffect(() => {
    if (!deleteTarget) { setDeleteCountdown(0); return; }
    setDeleteCountdown(3);
    const interval = setInterval(() => {
      setDeleteCountdown((n) => {
        if (n <= 1) { clearInterval(interval); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [deleteTarget]);

  async function handleSave(formData: Record<string, unknown>) {
    setModalLoading(true);
    setError("");
    try {
      const payload = { ...formData };
      Object.keys(payload).forEach((key) => {
        if (payload[key] === "" && (!editRow || key.endsWith("_id") || key === "slug")) {
          delete payload[key];
        }
      });
      if (config.apiSection === "listings") {
        payload.currency ||= "EGP";
        if (payload.full_address) payload.location = payload.full_address;
        payload.city ||= payload.location || payload.full_address;
        if ((payload.category === "for_rent" || payload.category === "shared_housing") && !payload.price_period) {
          payload.price_period = "monthly";
        }
        if (payload.category === "shared_housing" && Array.isArray(payload.amenities) && payload.amenities.length === 0) {
          payload.amenities = Array.from(new Set([
            ...parseCommaList(payload.private_amenities),
            ...parseCommaList(payload.shared_amenities),
          ]));
        }
      }
      if (config.apiSection === "blog" && payload.is_published === true && !payload.published_at) {
        payload.published_at = new Date().toISOString();
      }
      if (editRow) {
        await updateItem(config.apiSection, String(editRow.id), payload);
        setEditRow(null);
      } else {
        await createItem(config.apiSection, payload);
        setCreating(false);
      }
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setModalLoading(true);
    try {
      await deleteItem(config.apiSection, String(deleteTarget.id));
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setModalLoading(false);
    }
  }

  if (!config) return <p className="text-slate-400 p-4">Section not configured</p>;

  const singularTitle = config.title.replace(/s$/, "");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600">Live table</p>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">{config.title}</h2>
          </div>
          {!loading && total > 0 && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">
              {total.toLocaleString()} records
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={config.searchPlaceholder}
              className="w-56 rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-800 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Extra filters */}
          {config.extraFilters?.map((f) => (
            <select
              key={f.key}
              value={filters[f.key] ?? ""}
              onChange={(e) => { setFilters((prev) => ({ ...prev, [f.key]: e.target.value })); setPage(1); }}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All {f.label}s</option>
              {f.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ))}

          {/* Refresh */}
          <button
            onClick={load}
            className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-500 transition-[background-color,color,transform] hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.97]"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Add button */}
          {config.canCreate && (
            <button
              onClick={() => {
                if (isListingsSection) resetAdminListingMeta();
                setCreating(true);
              }}
              className="group inline-flex items-center gap-2 rounded-2xl bg-zinc-950 py-1.5 pl-4 pr-1.5 text-sm font-semibold text-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.95)] transition-[background-color,transform] hover:bg-zinc-800 active:scale-[0.98]"
            >
              <span>Add {singularTitle}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-600 transition-transform group-hover:translate-x-0.5">
                <Plus className="h-4 w-4" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <AdminTable
        columns={config.columns}
        data={data}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
        onEdit={config.readOnly ? undefined : (row) => setEditRow(row)}
        onDelete={config.readOnly ? undefined : (row) => setDeleteTarget(row)}
        onView={(row) => setViewRow(row)}
      />

      {/* Edit Modal */}
      <AdminModal
        title={`Edit ${singularTitle}`}
        eyebrow="Edit record"
        description={`Update the ${singularTitle.toLowerCase()} fields that are relevant to this admin section.`}
        open={!!editRow}
        onClose={() => setEditRow(null)}
        width={isListingsSection ? "max-w-5xl" : sectionId === "agencies" || sectionId === "projects" || sectionId === "universities" ? "max-w-2xl" : "max-w-lg"}
      >
        {editRow && isListingsSection ? (
          <AdminListingEditForm
            initial={editRow}
            onSave={handleSave}
            onCancel={() => setEditRow(null)}
            loading={modalLoading}
          />
        ) : editRow ? (
          <EntityForm
            fields={config.editFields}
            initial={editRow}
            onSave={handleSave}
            onCancel={() => setEditRow(null)}
            loading={modalLoading}
          />
        ) : null}
      </AdminModal>

      {isListingsSection ? (
        <AddListingModal
          open={creating}
          onClose={() => {
            setCreating(false);
            resetAdminListingMeta();
          }}
          onSuccess={() => {
            setCreating(false);
            resetAdminListingMeta();
            load();
          }}
          title="Add Listing"
          submitLabel={adminListingMeta.status === "active" ? "Publish Listing" : "Create Listing"}
          footerNote="Admin-created listings can be published immediately or saved as pending."
          getSignedUploadUrl={getAdminSignedUploadUrl}
          createListing={(payload) => createItem(config.apiSection, payload)}
          validateBeforeSubmit={() =>
            adminListingMeta.owner_id ? null : "Choose the listing owner before continuing."
          }
          getAdditionalPayload={() => ({
            owner_id: adminListingMeta.owner_id,
            agency_id: adminListingMeta.agency_id || undefined,
            project_id: adminListingMeta.project_id || undefined,
            university_id: adminListingMeta.university_id || undefined,
            status: adminListingMeta.status || "active",
          })}
          renderBeforeBasics={
            <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  Admin ownership
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Connect this listing to the live owner, agency, and project records before filling the public listing details.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    Owner <span className="text-red-400">*</span>
                  </label>
                  <EntityPicker
                    value={adminListingMeta.owner_id}
                    displayValue={adminListingMeta.owner_label}
                    section="users"
                    placeholder="Search users..."
                    onChange={(id, label) =>
                      setAdminListingMeta((prev) => ({
                        ...prev,
                        owner_id: id,
                        owner_label: label,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">Publish Status</label>
                  <select
                    value={adminListingMeta.status}
                    onChange={(e) =>
                      setAdminListingMeta((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-input-dark px-4 py-3 text-sm text-white transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="active">Active - visible now</option>
                    <option value="pending">Pending - needs review</option>
                    <option value="rejected">Rejected - hidden</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">Agency</label>
                  <EntityPicker
                    value={adminListingMeta.agency_id}
                    displayValue={adminListingMeta.agency_label}
                    section="agencies"
                    placeholder="Search agencies..."
                    onChange={(id, label) =>
                      setAdminListingMeta((prev) => ({
                        ...prev,
                        agency_id: id,
                        agency_label: label,
                        project_id: "",
                        project_label: "",
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">Project</label>
                  <EntityPicker
                    value={adminListingMeta.project_id}
                    displayValue={adminListingMeta.project_label}
                    section="projects"
                    placeholder={
                      adminListingMeta.agency_id ? "Search projects..." : "Choose agency first"
                    }
                    disabled={!adminListingMeta.agency_id}
                    extraParams={
                      adminListingMeta.agency_id
                        ? { agency_id: adminListingMeta.agency_id }
                        : undefined
                    }
                    onChange={(id, label) =>
                      setAdminListingMeta((prev) => ({
                        ...prev,
                        project_id: id,
                        project_label: label,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">University</label>
                  <EntityPicker
                    value={adminListingMeta.university_id}
                    displayValue={adminListingMeta.university_label}
                    section="universities"
                    placeholder="Search universities..."
                    onChange={(id, label) =>
                      setAdminListingMeta((prev) => ({
                        ...prev,
                        university_id: id,
                        university_label: label,
                      }))
                    }
                  />
                </div>
              </div>
            </section>
          }
        />
      ) : (
        <AdminModal
          title={`Add New ${singularTitle}`}
          eyebrow="Create record"
          description={`Create a live ${singularTitle.toLowerCase()} record with the fields used by this section.`}
          open={creating}
          onClose={() => setCreating(false)}
          width={sectionId === "agencies" || sectionId === "projects" || sectionId === "universities" || sectionId === "blog" ? "max-w-3xl" : "max-w-2xl"}
        >
          <EntityForm
            fields={config.createFields ?? config.editFields}
            onSave={handleSave}
            onCancel={() => setCreating(false)}
            loading={modalLoading}
          />
        </AdminModal>
      )}

      {/* Delete Confirm */}
      <AdminModal
        title="Confirm Deletion"
        eyebrow="Danger zone"
        description="This action permanently removes the selected record."
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
      >
        <div className="flex flex-col items-center text-center gap-4 pb-2">
          <div className="w-14 h-14 bg-red-50 border-2 border-red-100 rounded-full flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-base">
              Delete &ldquo;{String(deleteTarget?.title ?? deleteTarget?.name ?? deleteTarget?.full_name ?? "this record")}&rdquo;?
            </p>
            <p className="text-sm text-slate-500 mt-1">
              This action is permanent and cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setDeleteTarget(null)}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={modalLoading || deleteCountdown > 0}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition"
          >
            {modalLoading
              ? "Deleting…"
              : deleteCountdown > 0
              ? `Wait (${deleteCountdown})`
              : "Yes, Delete"}
          </button>
        </div>
      </AdminModal>

      {/* View Modal */}
      <AdminModal
        title={`${singularTitle} Details`}
        eyebrow="View record"
        description="A readable snapshot of the fields connected to this admin section."
        open={!!viewRow}
        onClose={() => setViewRow(null)}
        width="max-w-4xl"
      >
        {viewRow && <AdminRecordDetails row={viewRow} config={config} />}
      </AdminModal>
    </div>
  );
}

// ── Pending Approvals View ─────────────────────────────────────────────────────

function PendingApprovalsView() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listItems<Record<string, unknown>>("listings", {
        status: "pending",
        page,
        per_page: 15,
      });
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id: string) {
    setActioning(id);
    try {
      await approveListing(id);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    setActioning(id);
    try {
      await rejectListing(id, rejectReason);
      setRejectTarget(null);
      setRejectReason("");
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setActioning(null);
    }
  }

  const columns: Column[] = [
    { key: "title", label: "Listing" },
    { key: "price", label: "Price", render: (v) => formatPrice(v) },
    { key: "location", label: "Location" },
    { key: "property_type", label: "Type", render: (v) => <Badge color="purple">{String(v ?? "")}</Badge> },
    { key: "created_at", label: "Submitted", render: (v) => formatDate(v) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-900">Pending Approvals</h2>
          {!loading && total > 0 && (
            <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full">
              {total} pending
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {columns.map((col) => (
                  <th key={col.key} className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">{col.label}</th>
                ))}
                <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3.5"><div className="h-4 bg-slate-100 rounded-full w-3/4" /></td>
                    ))}
                    <td className="px-4 py-3.5"><div className="h-7 bg-slate-100 rounded-lg w-36 ml-auto" /></td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-slate-600 font-medium text-sm">No pending listings</p>
                        <p className="text-slate-400 text-xs mt-0.5">All caught up!</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={String(row.id)} className="hover:bg-slate-50 transition-colors">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3.5 text-slate-700">
                        {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "—")}
                      </td>
                    ))}
                    <td className="px-4 py-3.5">
                      {rejectTarget === String(row.id) ? (
                        <div className="flex items-center gap-2 justify-end">
                          <input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason…"
                            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 w-36"
                          />
                          <button
                            onClick={() => handleReject(String(row.id))}
                            disabled={!rejectReason.trim() || actioning === String(row.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-60 transition"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => { setRejectTarget(null); setRejectReason(""); }}
                            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(String(row.id))}
                            disabled={actioning === String(row.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-60 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectTarget(String(row.id))}
                            disabled={actioning === String(row.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-60 transition"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
            <span className="text-xs text-slate-500">{total} pending listings</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 transition">
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              </button>
              <span className="text-xs text-slate-600 font-medium">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 transition">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard Overview ─────────────────────────────────────────────────────────

type AdminNavigate = (section: string, filters?: Record<string, string>) => void;

function DashboardOverview({ onNavigate }: { onNavigate: AdminNavigate }) {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getStats>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats().then(setStats).catch(() => null).finally(() => setLoading(false));
  }, []);

  const statCards: Array<{
    label: string;
    key: keyof NonNullable<typeof stats>;
    icon: ElementType;
    color: string;
    section: string;
    filters?: Record<string, string>;
  }> = [
    { label: "Total Users", key: "total_users", icon: Users, color: "blue", section: "users" },
    { label: "Active Listings", key: "active_listings", icon: Home, color: "green", section: "listings", filters: { status: "active" } },
    { label: "Pending Review", key: "pending_listings", icon: Clock, color: "orange", section: "listings", filters: { status: "pending" } },
    { label: "Agencies", key: "total_agencies", icon: Building2, color: "purple", section: "agencies" },
    { label: "Leads", key: "total_leads", icon: TrendingUp, color: "green", section: "leads" },
    { label: "Shared Housing", key: "total_shared_housing", icon: BedDouble, color: "orange", section: "listings", filters: { category: "shared_housing" } },
  ];

  const quickActions = [
    { label: "Manage Users", section: "users", icon: Users, color: "blue" },
    { label: "Review Listings", section: "pending-approvals", icon: Home, color: "green" },
  ] as const;

  const actionColors = {
    blue:   { border: "border-sky-100",    bg: "bg-sky-50",    hover: "hover:border-sky-300 hover:bg-sky-100",       icon: "text-sky-600"   },
    green:  { border: "border-emerald-100", bg: "bg-emerald-50", hover: "hover:border-emerald-300 hover:bg-emerald-100", icon: "text-emerald-600" },
    purple: { border: "border-zinc-200", bg: "bg-zinc-50", hover: "hover:border-zinc-300 hover:bg-zinc-100", icon: "text-zinc-700" },
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="max-w-3xl">
        <p className="mb-2 inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-700">
          Live database
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">Platform control room</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">A current snapshot of listings, moderation queues, leads, and content moving through AXIOM.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ label, key, icon, color, section, filters }) => (
          <StatCard
            key={label}
            label={label}
            value={loading ? "—" : (stats?.[key as keyof typeof stats] ?? 0)}
            icon={icon}
            color={color}
            onClick={() => onNavigate(section, filters)}
          />
        ))}
      </div>

      {/* Quick actions */}
      <div className="rounded-[1.35rem] border border-zinc-200/80 bg-white p-5 shadow-[0_22px_70px_-45px_rgba(15,23,42,0.55)]">
        <h3 className="mb-4 text-sm font-semibold text-zinc-800">Priority queues</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map(({ label, section, icon: Icon, color }) => {
            const c = actionColors[color];
            return (
              <button
                key={section}
                onClick={() => onNavigate(section)}
                className={`flex flex-col items-center gap-2.5 rounded-2xl border px-3 py-4 transition-[background-color,border-color,transform,box-shadow] hover:shadow-sm active:scale-[0.98] ${c.border} ${c.bg} ${c.hover}`}
              >
                <Icon className={`w-5 h-5 ${c.icon}`} />
                <span className="text-xs font-semibold text-slate-700">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sectionFilters, setSectionFilters] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navigateAdmin: AdminNavigate = useCallback((section, filters = {}) => {
    setSectionFilters(filters);
    setActiveSection(section);
  }, []);

  useEffect(() => {
    setMounted(true);
    if (!isLoggedIn()) {
      router.replace("/admin/login");
    }
  }, [router]);

  if (!mounted) return null;

  function renderSection() {
    if (activeSection === "dashboard") return <DashboardOverview onNavigate={navigateAdmin} />;
    if (activeSection === "pending-approvals") return <PendingApprovalsView />;
    if (SECTIONS[activeSection]) return <SectionView sectionId={activeSection} initialFilters={sectionFilters} />;
    return <p className="text-slate-400">Section not found</p>;
  }

  const currentTitle =
    activeSection === "dashboard" ? "Dashboard Overview"
    : SECTIONS[activeSection]?.title ?? activeSection;

  return (
    <div className="flex min-h-screen bg-[#f7f5f1]">
      {/* Desktop sidebar — sticky, visible lg+ */}
      <aside className="hidden lg:block sticky top-0 h-screen w-64 shrink-0 z-40">
        <AdminSidebar active={activeSection} onNavigate={navigateAdmin} />
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-zinc-200/70 bg-[#f7f5f1]/92 px-4 py-3.5 shadow-[0_14px_45px_-38px_rgba(15,23,42,0.65)] backdrop-blur-sm sm:px-6">
          {/* Mobile hamburger — visible below lg */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <button className="rounded-xl p-2 transition hover:bg-white lg:hidden" aria-label="Open navigation">
                <Menu className="w-5 h-5 text-zinc-700" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-slate-900 border-r-0">
              <SheetTitle className="sr-only">Admin navigation</SheetTitle>
              <AdminSidebar
                active={activeSection}
                onNavigate={(section) => {
                  navigateAdmin(section);
                  setMobileNavOpen(false);
                }}
              />
            </SheetContent>
          </Sheet>

          <div>
            {/* Breadcrumb */}
            <div className="mb-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
              <span>Admin</span>
              {activeSection !== "dashboard" && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="font-medium text-zinc-600">{currentTitle}</span>
                </>
              )}
            </div>
            <h1 className="text-sm font-bold text-zinc-950">{currentTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-zinc-400">Logged in as</p>
              <p className="text-xs font-semibold text-zinc-700">Super Admin</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-sm font-bold text-white shadow">
              A
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">{renderSection()}</div>
      </main>
    </div>
  );
}
