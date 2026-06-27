"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  X,
  CloudUpload,
  Minus,
  Plus,
  Sparkles,
  Loader2,
  MapPin,
  AlertCircle,
  Check,
} from "lucide-react";
import {
  LISTING_AMENITIES,
  LISTING_CATEGORIES,
  PROPERTY_TYPES,
  FURNISHING_OPTIONS,
} from "@/lib/constants";
import { api } from "@/lib/api";
import { formatEGP } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { subscriptionQuery } from "@/lib/queries";
import Link from "next/link";

type ListingCategory = "for_rent" | "for_sale" | "shared_housing";
type ListingStep = 0 | 1 | 2;

interface FormState {
  title: string;
  category: ListingCategory;
  property_type: string;
  full_address: string;
  price: string;
  size_sqm: string;
  bedrooms: number;
  bathrooms: number;
  floor_number: string;
  total_floors: string;
  furnishing: string;
  lease_type: string;
  min_stay_months: string;
  available_date: string;
  title_deed_status: string;
  delivery_date: string;
  payment_plan: string;
  room_type: string;
  total_spots: string;
  filled_spots: string;
  bathroom_type: string;
  utilities_included: boolean;
  gender_preference: string;
  cleanliness_level: string;
  smoking_policy: string;
  pets_policy: string;
  availability: string;
  amenities: string[];
  private_amenities: string[];
  shared_amenities: string[];
  description: string;
}

interface FormErrors {
  title?: string;
  full_address?: string;
  price?: string;
  size_sqm?: string;
  lease_type?: string;
  min_stay_months?: string;
  available_date?: string;
  title_deed_status?: string;
  room_type?: string;
  total_spots?: string;
  filled_spots?: string;
  bathroom_type?: string;
}

const INITIAL_FORM: FormState = {
  title: "",
  category: "for_rent",
  property_type: "Apartment",
  full_address: "",
  price: "",
  size_sqm: "",
  bedrooms: 3,
  bathrooms: 2,
  floor_number: "",
  total_floors: "",
  furnishing: "",
  lease_type: "monthly",
  min_stay_months: "12",
  available_date: "",
  title_deed_status: "ready",
  delivery_date: "",
  payment_plan: "cash",
  room_type: "private",
  total_spots: "1",
  filled_spots: "0",
  bathroom_type: "shared",
  utilities_included: true,
  gender_preference: "female",
  cleanliness_level: "moderate",
  smoking_policy: "outside_only",
  pets_policy: "ask_first",
  availability: "available",
  amenities: ["Parking"],
  private_amenities: ["Private Room"],
  shared_amenities: ["Central AC", "Elevator"],
  description: "",
};

const STEPS = ["Basics", "Details", "Photos"] as const;

const CATEGORY_COPY: Record<
  ListingCategory,
  { priceLabel: string; priceHint: string; detailTitle: string; detailHint: string }
> = {
  for_rent: {
    priceLabel: "Monthly Rent",
    priceHint: "Rental listings need lease terms, move-in timing, furnishing, and core room details.",
    detailTitle: "Rental Details",
    detailHint: "Set the monthly rent and rental conditions tenants need before contacting you.",
  },
  for_sale: {
    priceLabel: "Sale Price",
    priceHint: "Sale listings need ownership and payment details, not monthly lease terms.",
    detailTitle: "Sale Details",
    detailHint: "Capture purchase price, ownership status, delivery timing, and the property footprint.",
  },
  shared_housing: {
    priceLabel: "Monthly Price Per Spot",
    priceHint: "Shared housing needs room setup, open spots, lifestyle fit, and shared amenities.",
    detailTitle: "Shared Housing Details",
    detailHint: "Tune the listing around roommate matching and house rules.",
  },
};

const PRIVATE_FEATURE_PRESETS = [
  "Private Room",
  "Ensuite Bathroom",
  "Private Bathroom",
  "Private Balcony",
  "Private Workspace",
  "Private AC",
  "Wardrobe",
  "Private TV",
] as const;

const SHARED_FEATURE_PRESETS = [
  "Central AC",
  "Balcony",
  "Elevator",
  "Shared Kitchen",
  "WiFi",
  "Washing Machine",
  "Security",
  "Parking",
  "Gym",
  "Garden",
] as const;

const TOTAL_FLOORS_PROPERTY_TYPES = [
  "Villa",
  "Duplex",
  "Townhouse",
  "Penthouse",
  "Chalet",
  "Office",
  "Commercial",
] as const;

interface AddListingModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  submitLabel?: string;
  footerNote?: string;
  renderBeforeBasics?: React.ReactNode;
  validateBeforeSubmit?: () => string | null;
  getAdditionalPayload?: () => Record<string, unknown>;
  createListing?: (payload: Record<string, unknown>) => Promise<unknown>;
  getSignedUploadUrl?: (
    bucket: string,
    filename: string
  ) => Promise<{ upload_url: string; public_url: string }>;
}

export default function AddListingModal({
  open,
  onClose,
  onSuccess,
  title = "Add New Listing",
  submitLabel = "Submit for Review",
  footerNote = "Listings are reviewed by an admin before going live.",
  renderBeforeBasics,
  validateBeforeSubmit,
  getAdditionalPayload,
  createListing,
  getSignedUploadUrl,
}: AddListingModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const { data: sub } = useQuery(subscriptionQuery);
  const queryClient = useQueryClient();
  const atCap = sub ? sub.active_listings >= sub.listing_cap : false;
  const [errors, setErrors] = useState<FormErrors>({});
  const [step, setStep] = useState<ListingStep>(0);

  // Custom amenity state
  const [customAmenity, setCustomAmenity] = useState("");
  const [customPrivateFeature, setCustomPrivateFeature] = useState("");
  const [customSharedFeature, setCustomSharedFeature] = useState("");
  const [amenityError, setAmenityError] = useState("");
  const [checkingAmenity, setCheckingAmenity] = useState(false);

  // Photo state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  // AI description state
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function closeModal() {
    setStep(0);
    setErrors({});
    setSubmitError("");
    onClose();
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCategoryChange(category: ListingCategory) {
    setForm((prev) => ({
      ...prev,
      category,
      lease_type: category === "for_sale" ? "" : prev.lease_type || "monthly",
      min_stay_months: category === "for_sale" ? "" : prev.min_stay_months || "12",
      title_deed_status:
        category === "for_sale" ? prev.title_deed_status || "ready" : "",
      payment_plan: category === "for_sale" ? "cash" : "",
      delivery_date:
        category === "for_sale" && prev.title_deed_status !== "ready"
          ? prev.delivery_date
          : "",
      total_floors:
        category === "for_sale" &&
        (TOTAL_FLOORS_PROPERTY_TYPES as readonly string[]).includes(prev.property_type)
          ? prev.total_floors
          : "",
      room_type: category === "shared_housing" ? prev.room_type || "private" : "",
      total_spots: category === "shared_housing" ? prev.total_spots || "1" : "",
      filled_spots: category === "shared_housing" ? prev.filled_spots || "0" : "",
      bathroom_type:
        category === "shared_housing" ? prev.bathroom_type || "shared" : "",
      availability:
        category === "shared_housing" ? prev.availability || "available" : "",
    }));
    setErrors({});
  }

  function toggleAmenity(amenity: string) {
    setField(
      "amenities",
      form.amenities.includes(amenity)
        ? form.amenities.filter((a) => a !== amenity)
        : [...form.amenities, amenity]
    );
  }

  function toggleFeature(
    key: "private_amenities" | "shared_amenities",
    otherKey: "private_amenities" | "shared_amenities",
    feature: string
  ) {
    setForm((prev) => {
      const active = prev[key].includes(feature);
      return {
        ...prev,
        [key]: active
          ? prev[key].filter((item) => item !== feature)
          : [...prev[key], feature],
        [otherKey]: prev[otherKey].filter((item) => item !== feature),
      };
    });
    setAmenityError("");
  }

  function addCustomFeature(
    key: "private_amenities" | "shared_amenities",
    otherKey: "private_amenities" | "shared_amenities",
    value: string,
    clear: () => void
  ) {
    const feature = value.trim();
    if (!feature) return;
    if (form[key].includes(feature)) {
      setAmenityError("Already in this feature list");
      return;
    }
    setForm((prev) => ({
      ...prev,
      [key]: [...prev[key], feature],
      [otherKey]: prev[otherKey].filter((item) => item !== feature),
    }));
    clear();
    setAmenityError("");
  }

  async function handleCustomAmenitySubmit() {
    const value = customAmenity.trim();
    if (!value) return;
    if (form.amenities.includes(value)) {
      setAmenityError("Already in the list");
      return;
    }

    setCheckingAmenity(true);
    setAmenityError("");
    try {
      const res = await api.post<{ ok: boolean; reason: string }>(
        "/api/ai/validate-amenity",
        { amenity: value }
      );
      if (res.ok) {
        setField("amenities", [...form.amenities, value]);
        setCustomAmenity("");
      } else {
        setAmenityError(`Flagged: ${res.reason}`);
      }
    } catch {
      // Network error → fail-open
      setField("amenities", [...form.amenities, value]);
      setCustomAmenity("");
    } finally {
      setCheckingAmenity(false);
    }
  }

  function handleFileSelect(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    const newPreviews = arr.map((f) => URL.createObjectURL(f));
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
    setPhotoFiles((prev) => [...prev, ...arr]);
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadPhotos(): Promise<string[]> {
    const urls: string[] = [];
    for (const file of photoFiles) {
      try {
        const { upload_url, public_url } = getSignedUploadUrl
          ? await getSignedUploadUrl("listing-images", file.name)
          : await api.post<{
              upload_url: string;
              public_url: string;
            }>("/api/uploads/signed-url", {
              bucket: "listing-images",
              filename: file.name,
            });
        await fetch(upload_url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        urls.push(public_url);
      } catch {
        // skip failed uploads — listing still saves without that photo
      }
    }
    return urls;
  }

  async function generateDescription() {
    setGeneratingDesc(true);
    try {
      const city = form.full_address || "Cairo";
      const extraParts: string[] = [];
      if (form.furnishing) extraParts.push(`Furnishing: ${form.furnishing}`);
      if (form.floor_number) extraParts.push(`Floor: ${form.floor_number}`);
      if (form.full_address) extraParts.push(`Address: ${form.full_address}`);

      const res = await api.post<{
        description?: string;
        english?: string;
        ai_unavailable?: boolean;
      }>("/api/ai/description", {
        title: form.title || "Untitled",
        city,
        category: form.category,
        property_type: form.property_type,
        price: form.price ? Number(form.price) : null,
        size_sqm: form.size_sqm ? Number(form.size_sqm) : null,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        amenities: form.amenities,
        extra_notes: extraParts.join(". "),
      });
      const text = res.description ?? res.english ?? "";
      if (text) {
        setField("description", text);
        // Refresh the AI quota counter — the backend just decremented it.
        queryClient.invalidateQueries({ queryKey: subscriptionQuery.queryKey });
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setGeneratingDesc(false);
    }
  }

  function validateStep(targetStep: ListingStep = step): boolean {
    const newErrors: FormErrors = {};
    if (targetStep === 0) {
      if (!form.title.trim()) newErrors.title = "Listing name is required";
      if (!form.full_address.trim())
        newErrors.full_address = "Address is required";
    }
    if (targetStep === 1) {
      if (!form.price || Number(form.price) <= 0)
        newErrors.price = "Enter a price greater than 0";
      if (!form.size_sqm || Number(form.size_sqm) <= 0)
        newErrors.size_sqm = "Enter the property size";

      if (form.category === "for_rent") {
        if (!form.lease_type) newErrors.lease_type = "Choose a lease type";
        if (!form.min_stay_months || Number(form.min_stay_months) <= 0)
          newErrors.min_stay_months = "Enter minimum stay";
        if (!form.available_date)
          newErrors.available_date = "Choose an available date";
      }

      if (form.category === "for_sale" && !form.title_deed_status) {
        newErrors.title_deed_status = "Choose title deed status";
      }

      if (form.category === "shared_housing") {
        if (!form.room_type) newErrors.room_type = "Choose room type";
        const totalSpots = Number(form.total_spots);
        const filledSpots = Number(form.filled_spots || 0);
        if (!form.total_spots || totalSpots <= 0)
          newErrors.total_spots = "Enter available spots";
        if (filledSpots < 0 || filledSpots > totalSpots)
          newErrors.filled_spots = "Occupied spots must be between 0 and total spots";
        if (!form.bathroom_type) newErrors.bathroom_type = "Choose bathroom type";
        if (!form.available_date)
          newErrors.available_date = "Choose an available date";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(prev + 1, 2) as ListingStep);
  }

  async function submitListing() {
    const externalError = validateBeforeSubmit?.();
    if (externalError) {
      setSubmitError(externalError);
      setStep(0);
      return;
    }
    if (!validateStep(0)) {
      setStep(0);
      return;
    }
    if (!validateStep(1)) {
      setStep(1);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const images = await uploadPhotos();
      const combinedSharedHousingAmenities = Array.from(
        new Set([...form.private_amenities, ...form.shared_amenities])
      );
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        full_address: form.full_address,
        location: form.full_address,
        city: form.full_address,
        price: Number(form.price),
        size_sqm: form.size_sqm ? Number(form.size_sqm) : null,
        category: form.category,
        property_type: form.property_type.toLowerCase(),
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        floor_number: form.floor_number ? Number(form.floor_number) : null,
        total_floors: showSaleTotalFloors && form.total_floors ? Number(form.total_floors) : null,
        furnishing: form.furnishing ? form.furnishing.toLowerCase() : null,
        price_period: recurringPrice ? "monthly" : null,
        lease_type:
          form.category === "for_rent" || form.category === "shared_housing"
            ? form.lease_type
            : null,
        min_stay_months:
          form.category === "for_rent" || form.category === "shared_housing"
            ? Number(form.min_stay_months || 1)
            : null,
        available_date:
          form.category === "for_rent" || form.category === "shared_housing"
            ? form.available_date || null
            : null,
        title_deed_status:
          form.category === "for_sale" ? form.title_deed_status || null : null,
        delivery_date: showSaleDeliveryDate ? form.delivery_date || null : null,
        payment_plan:
          form.category === "for_sale"
            ? {
                type: "cash",
              }
            : null,
        room_type:
          form.category === "shared_housing" ? form.room_type || null : null,
        total_spots:
          form.category === "shared_housing"
            ? Number(form.total_spots || 1)
            : null,
        filled_spots:
          form.category === "shared_housing"
            ? Number(form.filled_spots || 0)
            : null,
        availability:
          form.category === "shared_housing" ? form.availability || null : null,
        utilities_included:
          form.category === "shared_housing" ? form.utilities_included : null,
        bathroom_type:
          form.category === "shared_housing" ? form.bathroom_type || null : null,
        lifestyle_preferences:
          form.category === "shared_housing"
            ? {
                gender_preference: form.gender_preference,
                cleanliness: form.cleanliness_level,
                smoking_allowed: form.smoking_policy === "allowed" || form.smoking_policy === "outside_only",
                pets_allowed: form.pets_policy === "pets_ok" || form.pets_policy === "ask_first",
              }
            : null,
        private_amenities:
          form.category === "shared_housing" ? form.private_amenities : [],
        shared_amenities:
          form.category === "shared_housing" ? form.shared_amenities : [],
        description: form.description,
        amenities:
          form.category === "shared_housing"
            ? combinedSharedHousingAmenities
            : form.amenities,
        images,
        ...(getAdditionalPayload?.() ?? {}),
      };
      if (createListing) {
        await createListing(payload);
      } else {
        await api.post("/api/listings", payload);
      }
      onSuccess?.();
      closeModal();
      setForm(INITIAL_FORM);
      setPhotoPreviews([]);
      setPhotoFiles([]);
    } catch {
      setSubmitError("Failed to save listing. Make sure the backend is running.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const customAmenities = form.amenities.filter(
    (a) => !(LISTING_AMENITIES as readonly string[]).includes(a)
  );
  const priceNumber = Number(form.price);
  const recurringPrice = form.category === "for_rent" || form.category === "shared_housing";
  const categoryCopy = CATEGORY_COPY[form.category];
  const showSaleDeliveryDate =
    form.category === "for_sale" && form.title_deed_status !== "ready";
  const showSaleTotalFloors =
    form.category === "for_sale" &&
    (TOTAL_FLOORS_PROPERTY_TYPES as readonly string[]).includes(form.property_type);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />

      <div className="flex min-h-screen items-center justify-center p-4 sm:p-0">
        <div className="relative transform rounded-3xl bg-card-dark text-left shadow-2xl sm:my-8 w-[95vw] max-w-4xl border border-white/10 flex flex-col" style={{ maxHeight: "min(90vh, 860px)" }}>

          {/* Header */}
          <div className="bg-black/20 px-4 py-5 sm:px-8 border-b border-white/5 flex justify-between items-center flex-shrink-0">
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <button
              onClick={closeModal}
              className="text-gray-400 hover:text-white transition-colors rounded-lg p-1 hover:bg-white/5"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form body */}
          <div className="px-4 py-6 sm:px-8 space-y-8 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
              {STEPS.map((label, index) => {
                const active = step === index;
                const complete = step > index;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (index <= step) {
                        setStep(index as ListingStep);
                        return;
                      }
                      if (index === step + 1 && validateStep(step)) {
                        setStep(index as ListingStep);
                      }
                    }}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold transition-all sm:text-sm ${
                      active
                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                        : complete
                          ? "bg-white/10 text-white"
                          : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/20 text-[11px]">
                      {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Section 1: Basics ── */}
            {step === 0 && (
              <>
            {renderBeforeBasics}

            <section className="space-y-4">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                Basics
              </p>

              {/* Listing Name */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-300">
                  Listing Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => {
                    setField("title", e.target.value);
                    setErrors((p) => ({ ...p, title: undefined }));
                  }}
                  placeholder="e.g. Modern Apartment in Maadi"
                  className={`w-full bg-input-dark border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                    errors.title ? "border-red-500" : "border-white/10"
                  }`}
                />
                {errors.title && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {errors.title}
                  </p>
                )}
              </div>

              {/* Category + Property Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    Listing Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      handleCategoryChange(e.target.value as ListingCategory)
                    }
                    className="w-full bg-input-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm appearance-none cursor-pointer"
                  >
                    {LISTING_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    Property Type
                  </label>
                  <select
                    value={form.property_type}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        property_type: nextType,
                        total_floors:
                          prev.category === "for_sale" &&
                          (TOTAL_FLOORS_PROPERTY_TYPES as readonly string[]).includes(nextType)
                            ? prev.total_floors
                            : "",
                      }));
                    }}
                    className="w-full bg-input-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm appearance-none cursor-pointer"
                  >
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <div className="border-t border-white/5" />

            {/* ── Section 2: Location ── */}
            <section className="space-y-4">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                Location
              </p>

              <div className="space-y-1.5 relative">
                <label className="block text-sm font-medium text-gray-300">
                  Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    value={form.full_address}
                    onChange={(e) => {
                      setField("full_address", e.target.value);
                      setErrors((p) => ({ ...p, full_address: undefined }));
                    }}
                    placeholder="Enter property address…"
                    className={`w-full bg-input-dark border rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                      errors.full_address ? "border-red-500" : "border-white/10"
                    }`}
                  />
                </div>
                {errors.full_address && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {errors.full_address}
                  </p>
                )}
              </div>
            </section>

            <div className="border-t border-white/5" />
              </>
            )}

            {/* ── Section 3: Property Details ── */}
            {step === 1 && (
              <>
            <section className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                  {categoryCopy.detailTitle}
                </p>
                <p className="mt-1 text-sm text-gray-400">{categoryCopy.detailHint}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Price */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    {categoryCopy.priceLabel} <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-xs font-medium">
                      EGP
                    </span>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => {
                        setField("price", e.target.value);
                        setErrors((p) => ({ ...p, price: undefined }));
                      }}
                      placeholder="0"
                      className={`w-full bg-input-dark border rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                        errors.price ? "border-red-500" : "border-white/10"
                      }`}
                    />
                  </div>
                  {errors.price && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.price}
                    </p>
                  )}
                </div>

                {/* Size */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    Size <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={form.size_sqm}
                      onChange={(e) => {
                        setField("size_sqm", e.target.value);
                        setErrors((p) => ({ ...p, size_sqm: undefined }));
                      }}
                      placeholder="0"
                      className={`w-full bg-input-dark border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                        errors.size_sqm ? "border-red-500" : "border-white/10"
                      }`}
                    />
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500 text-xs font-medium">
                      sqm
                    </span>
                  </div>
                  {errors.size_sqm && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.size_sqm}
                    </p>
                  )}
                </div>

                {/* Floor */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    Floor
                  </label>
                  <input
                    type="number"
                    value={form.floor_number}
                    onChange={(e) => setField("floor_number", e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full bg-input-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Rooms */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    {form.category === "shared_housing" ? "Bedrooms in Home" : "Rooms"}
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setField("bedrooms", Math.max(0, form.bedrooms - 1))
                      }
                      className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center border border-white/5 transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center text-white font-bold">
                      {form.bedrooms}
                    </span>
                    <button
                      type="button"
                      onClick={() => setField("bedrooms", form.bedrooms + 1)}
                      className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center border border-white/5 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Bathrooms */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    Bathrooms
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setField("bathrooms", Math.max(0, form.bathrooms - 1))
                      }
                      className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center border border-white/5 transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center text-white font-bold">
                      {form.bathrooms}
                    </span>
                    <button
                      type="button"
                      onClick={() => setField("bathrooms", form.bathrooms + 1)}
                      className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center border border-white/5 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Furnishing */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    Furnishing
                  </label>
                  <select
                    value={form.furnishing}
                    onChange={(e) => setField("furnishing", e.target.value)}
                    className="w-full bg-input-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm appearance-none cursor-pointer"
                  >
                    <option value="">— Select —</option>
                    {FURNISHING_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.category === "for_rent" && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Rental Requirements
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Lease Type <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={form.lease_type}
                        onChange={(e) => {
                          setField("lease_type", e.target.value);
                          setErrors((p) => ({ ...p, lease_type: undefined }));
                        }}
                        className={`w-full bg-input-dark border rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                          errors.lease_type ? "border-red-500" : "border-white/10"
                        }`}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                      {errors.lease_type && (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors.lease_type}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Min Stay <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={form.min_stay_months}
                          onChange={(e) => {
                            setField("min_stay_months", e.target.value);
                            setErrors((p) => ({ ...p, min_stay_months: undefined }));
                          }}
                          className={`w-full bg-input-dark border rounded-xl px-4 py-3 pr-16 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                            errors.min_stay_months ? "border-red-500" : "border-white/10"
                          }`}
                        />
                        <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500 text-xs font-medium">
                          months
                        </span>
                      </div>
                      {errors.min_stay_months && (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors.min_stay_months}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Available Date <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.available_date}
                        onChange={(e) => {
                          setField("available_date", e.target.value);
                          setErrors((p) => ({ ...p, available_date: undefined }));
                        }}
                        className={`w-full bg-input-dark border rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                          errors.available_date ? "border-red-500" : "border-white/10"
                        }`}
                      />
                      {errors.available_date && (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors.available_date}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {form.category === "for_sale" && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Sale Requirements
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Title Deed <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={form.title_deed_status}
                        onChange={(e) => {
                          const nextTitleDeed = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            title_deed_status: nextTitleDeed,
                            delivery_date:
                              nextTitleDeed === "ready" ? "" : prev.delivery_date,
                          }));
                          setErrors((p) => ({ ...p, title_deed_status: undefined }));
                        }}
                        className={`w-full bg-input-dark border rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                          errors.title_deed_status ? "border-red-500" : "border-white/10"
                        }`}
                      >
                        <option value="ready">Ready</option>
                        <option value="off_plan">Off Plan</option>
                        <option value="pending">Pending</option>
                      </select>
                      {errors.title_deed_status && (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors.title_deed_status}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Payment Type
                      </label>
                      <div className="rounded-xl border border-white/10 bg-input-dark px-4 py-3 text-sm font-semibold text-white">
                        Full payment only
                      </div>
                    </div>
                    {showSaleDeliveryDate && (
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-300">
                          Delivery Date
                        </label>
                        <input
                          type="date"
                          value={form.delivery_date}
                          onChange={(e) => setField("delivery_date", e.target.value)}
                          className="w-full bg-input-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                        />
                      </div>
                    )}
                    {showSaleTotalFloors && (
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-300">
                          Total Floors
                        </label>
                        <input
                          type="number"
                          value={form.total_floors}
                          onChange={(e) => setField("total_floors", e.target.value)}
                          placeholder="e.g. 12"
                          className="w-full bg-input-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {form.category === "shared_housing" && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Shared Housing Requirements
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Room Type <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={form.room_type}
                        onChange={(e) => {
                          setField("room_type", e.target.value);
                          setErrors((p) => ({ ...p, room_type: undefined }));
                        }}
                        className={`w-full bg-input-dark border rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                          errors.room_type ? "border-red-500" : "border-white/10"
                        }`}
                      >
                        <option value="private">Private Room</option>
                        <option value="ensuite">Ensuite Room</option>
                        <option value="shared">Shared Room</option>
                      </select>
                      {errors.room_type && (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors.room_type}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Total Spots <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.total_spots}
                        onChange={(e) => {
                          setField("total_spots", e.target.value);
                          setErrors((p) => ({ ...p, total_spots: undefined, filled_spots: undefined }));
                        }}
                        className={`w-full bg-input-dark border rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                          errors.total_spots ? "border-red-500" : "border-white/10"
                        }`}
                      />
                      {errors.total_spots && (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors.total_spots}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Occupied Spots
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={form.total_spots || undefined}
                        value={form.filled_spots}
                        onChange={(e) => {
                          setField("filled_spots", e.target.value);
                          setErrors((p) => ({ ...p, filled_spots: undefined }));
                        }}
                        className={`w-full bg-input-dark border rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                          errors.filled_spots ? "border-red-500" : "border-white/10"
                        }`}
                      />
                      {errors.filled_spots && (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors.filled_spots}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Bathroom Type <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={form.bathroom_type}
                        onChange={(e) => {
                          setField("bathroom_type", e.target.value);
                          setErrors((p) => ({ ...p, bathroom_type: undefined }));
                        }}
                        className={`w-full bg-input-dark border rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                          errors.bathroom_type ? "border-red-500" : "border-white/10"
                        }`}
                      >
                        <option value="private">Private</option>
                        <option value="shared">Shared</option>
                      </select>
                      {errors.bathroom_type && (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors.bathroom_type}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Available Date <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.available_date}
                        onChange={(e) => {
                          setField("available_date", e.target.value);
                          setErrors((p) => ({ ...p, available_date: undefined }));
                        }}
                        className={`w-full bg-input-dark border rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${
                          errors.available_date ? "border-red-500" : "border-white/10"
                        }`}
                      />
                      {errors.available_date && (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors.available_date}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Preferred Gender
                      </label>
                      <select
                        value={form.gender_preference}
                        onChange={(e) => setField("gender_preference", e.target.value)}
                        className="w-full bg-input-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                      >
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                      </select>
                    </div>
                    <label className="flex min-h-[46px] items-center justify-between rounded-xl border border-white/10 bg-input-dark px-4 text-sm text-gray-300">
                      Utilities Included
                      <input
                        type="checkbox"
                        checked={form.utilities_included}
                        onChange={(e) => setField("utilities_included", e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Cleanliness
                      </label>
                      <select
                        value={form.cleanliness_level}
                        onChange={(e) => setField("cleanliness_level", e.target.value)}
                        className="w-full bg-input-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                      >
                        <option value="relaxed">Relaxed</option>
                        <option value="moderate">Moderate</option>
                        <option value="very_clean">Very clean</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Smoking
                      </label>
                      <select
                        value={form.smoking_policy}
                        onChange={(e) => setField("smoking_policy", e.target.value)}
                        className="w-full bg-input-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                      >
                        <option value="no_smoking">No smoking</option>
                        <option value="outside_only">Outside only</option>
                        <option value="allowed">Allowed</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Pets
                      </label>
                      <select
                        value={form.pets_policy}
                        onChange={(e) => setField("pets_policy", e.target.value)}
                        className="w-full bg-input-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                      >
                        <option value="no_pets">No pets</option>
                        <option value="ask_first">Ask first</option>
                        <option value="pets_ok">Pets OK</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <div className="border-t border-white/5" />

            {/* ── Section 4: Amenities ── */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                {form.category === "shared_housing" ? "Private & Shared Features" : "Amenities"}
              </p>

              {form.category === "shared_housing" ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-white">Private Features</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        Room-only features included with this spot.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {PRIVATE_FEATURE_PRESETS.map((feature) => {
                        const active = form.private_amenities.includes(feature);
                        return (
                          <button
                            key={feature}
                            type="button"
                            onClick={() =>
                              toggleFeature(
                                "private_amenities",
                                "shared_amenities",
                                feature
                              )
                            }
                            className={
                              active
                                ? "px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white border border-primary transition-all shadow-sm shadow-primary/20 flex items-center gap-1"
                                : "px-3 py-1.5 rounded-full text-xs font-medium bg-input-dark text-gray-300 border border-white/10 hover:border-white/30 hover:bg-[#333] transition-all"
                            }
                          >
                            {feature}
                            {active && <X className="h-3.5 w-3.5" />}
                          </button>
                        );
                      })}
                      {form.private_amenities
                        .filter(
                          (feature) =>
                            !(PRIVATE_FEATURE_PRESETS as readonly string[]).includes(feature)
                        )
                        .map((feature) => (
                          <button
                            key={feature}
                            type="button"
                            onClick={() =>
                              toggleFeature(
                                "private_amenities",
                                "shared_amenities",
                                feature
                              )
                            }
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white border border-primary transition-all shadow-sm shadow-primary/20 flex items-center gap-1"
                          >
                            {feature}
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <input
                        type="text"
                        value={customPrivateFeature}
                        onChange={(e) => {
                          setCustomPrivateFeature(e.target.value);
                          setAmenityError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomFeature(
                              "private_amenities",
                              "shared_amenities",
                              customPrivateFeature,
                              () => setCustomPrivateFeature("")
                            );
                          }
                        }}
                        placeholder="Add private feature..."
                        className="flex-1 bg-input-dark border border-dashed border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-white">Shared Features</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        Home and building features included with the shared space.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SHARED_FEATURE_PRESETS.map((feature) => {
                        const active = form.shared_amenities.includes(feature);
                        return (
                          <button
                            key={feature}
                            type="button"
                            onClick={() =>
                              toggleFeature(
                                "shared_amenities",
                                "private_amenities",
                                feature
                              )
                            }
                            className={
                              active
                                ? "px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white border border-primary transition-all shadow-sm shadow-primary/20 flex items-center gap-1"
                                : "px-3 py-1.5 rounded-full text-xs font-medium bg-input-dark text-gray-300 border border-white/10 hover:border-white/30 hover:bg-[#333] transition-all"
                            }
                          >
                            {feature}
                            {active && <X className="h-3.5 w-3.5" />}
                          </button>
                        );
                      })}
                      {form.shared_amenities
                        .filter(
                          (feature) =>
                            !(SHARED_FEATURE_PRESETS as readonly string[]).includes(feature)
                        )
                        .map((feature) => (
                          <button
                            key={feature}
                            type="button"
                            onClick={() =>
                              toggleFeature(
                                "shared_amenities",
                                "private_amenities",
                                feature
                              )
                            }
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white border border-primary transition-all shadow-sm shadow-primary/20 flex items-center gap-1"
                          >
                            {feature}
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <input
                        type="text"
                        value={customSharedFeature}
                        onChange={(e) => {
                          setCustomSharedFeature(e.target.value);
                          setAmenityError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomFeature(
                              "shared_amenities",
                              "private_amenities",
                              customSharedFeature,
                              () => setCustomSharedFeature("")
                            );
                          }
                        }}
                        placeholder="Add shared feature..."
                        className="flex-1 bg-input-dark border border-dashed border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                      />
                    </div>
                  </div>

                  {amenityError && (
                    <p className="text-red-400 text-xs flex items-center gap-1 md:col-span-2">
                      <AlertCircle className="h-3 w-3" />
                      {amenityError}
                    </p>
                  )}
                </div>
              ) : (
                <>
              <div className="flex flex-wrap gap-2">
                {/* Preset chips */}
                {LISTING_AMENITIES.map((amenity) => {
                  const active = form.amenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => toggleAmenity(amenity)}
                      className={
                        active
                          ? "px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white border border-primary transition-all shadow-sm shadow-primary/20 flex items-center gap-1"
                          : "px-3 py-1.5 rounded-full text-xs font-medium bg-input-dark text-gray-300 border border-white/10 hover:border-white/30 hover:bg-[#333] transition-all"
                      }
                    >
                      {amenity}
                      {active && <X className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}

                {/* Custom amenity chips */}
                {customAmenities.map((amenity) => (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white border border-primary transition-all shadow-sm shadow-primary/20 flex items-center gap-1"
                  >
                    {amenity}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>

              {/* Custom amenity input */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customAmenity}
                    onChange={(e) => {
                      setCustomAmenity(e.target.value);
                      setAmenityError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCustomAmenitySubmit();
                      }
                    }}
                    placeholder="Add custom amenity… (press Enter)"
                    disabled={checkingAmenity}
                    className="flex-1 bg-input-dark border border-dashed border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm disabled:opacity-50"
                  />
                  {checkingAmenity && (
                    <Loader2 className="h-4 w-4 text-gray-400 animate-spin shrink-0" />
                  )}
                </div>
                {amenityError && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {amenityError}
                  </p>
                )}
              </div>
                </>
              )}
            </section>

            <div className="border-t border-white/5" />
              </>
            )}

            {/* ── Section 5: Photos ── */}
            {step === 2 && (
              <>
            <section className="space-y-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                Photos
              </p>

              <div
                className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center hover:border-primary/50 hover:bg-primary/[0.02] transition-all cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileSelect(e.dataTransfer.files);
                }}
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="p-3 bg-white/5 rounded-full group-hover:bg-primary/10 transition-colors">
                    <CloudUpload className="h-6 w-6 text-gray-400 group-hover:text-primary" />
                  </div>
                  <p className="text-sm text-gray-300 font-medium">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    PNG, JPG or WEBP (max 10 MB each)
                  </p>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />

              {/* Thumbnail previews */}
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {photoPreviews.map((src, i) => (
                    <div
                      key={i}
                      className="relative group rounded-xl overflow-hidden aspect-video bg-black/20"
                    >
                      <Image
                        src={src}
                        alt={`Photo ${i + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="border-t border-white/5" />

            {/* ── Section 6: Description ── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                  Description
                </p>
                <div className="flex items-center gap-2">
                  {/* Generate button */}
                  {sub && sub.ai_quota > 0 && (
                    <span className="text-[10px] text-gray-500">
                      {sub.ai_remaining} AI gen{sub.ai_remaining !== 1 ? "s" : ""} left
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={generateDescription}
                    disabled={generatingDesc}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingDesc ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Generate with AI
                  </button>
                </div>
              </div>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={4}
                placeholder="Describe the property details, or click 'Generate with AI'…"
                className="w-full bg-input-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm resize-none"
              />
            </section>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-black/20 px-4 py-5 sm:px-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0 bg-card-dark">
            <p className="text-xs text-gray-500 shrink-0">
              {footerNote}
            </p>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {submitError && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {submitError}
                </p>
              )}
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((prev) => Math.max(prev - 1, 0) as ListingStep)}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Back
                </button>
              )}
              {step < 2 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  Continue
                </button>
              ) : atCap ? (
                <div className="flex flex-col items-end gap-1">
                  <p className="text-xs text-amber-400">
                    {sub?.active_listings ?? 0} of {sub?.listing_cap ?? 1} listings used.
                  </p>
                  <Link
                    href="/pricing"
                    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold text-black shadow-lg transition-all whitespace-nowrap"
                  >
                    Upgrade to add more
                  </Link>
                </div>
              ) : (
                <>
                  {sub && (
                    <p className="text-xs text-gray-500">
                      {sub.active_listings} of {sub.listing_cap} listings used.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={submitListing}
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      submitLabel
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
