"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, X, MapPin, BedDouble, DollarSign } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { formatEGP } from "@/lib/utils";

// ── Types ──

interface Preferences {
  budget_max: string;
  location: string;
  bedrooms: string;
  property_type: string;
  vibes: string[];
}

interface RecommendedListing {
  id: string;
  title: string;
  location: string;
  price: number;
  images: string[];
  bedrooms: number | null;
  property_type: string;
  reasoning?: string;
}

interface RecommendationsResponse {
  recommendations: RecommendedListing[];
  total: number;
}

const VIBE_OPTIONS = [
  "quiet", "family-friendly", "pet-friendly", "modern",
  "near-university", "furnished", "city-view", "garden",
];

const PROPERTY_TYPES = ["rent", "buy", "shared"];

// ── Preference modal ──

function PreferenceModal({
  onSubmit,
  onClose,
  loading,
}: {
  onSubmit: (prefs: Preferences) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [prefs, setPrefs] = useState<Preferences>({
    budget_max: "",
    location: "",
    bedrooms: "",
    property_type: "rent",
    vibes: [],
  });

  function toggleVibe(v: string) {
    setPrefs((p) => ({
      ...p,
      vibes: p.vibes.includes(v) ? p.vibes.filter((x) => x !== v) : [...p.vibes, v],
    }));
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-card-dark rounded-2xl border border-white/10 p-6 shadow-2xl shadow-black/50 max-w-lg w-full mx-auto"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-base font-bold text-white">What are you looking for?</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Budget + Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium">Max Budget (EGP/mo)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <input
                type="number"
                value={prefs.budget_max}
                onChange={(e) => setPrefs((p) => ({ ...p, budget_max: e.target.value }))}
                placeholder="8000"
                className="w-full bg-input-dark border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-white text-sm placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <input
                type="text"
                value={prefs.location}
                onChange={(e) => setPrefs((p) => ({ ...p, location: e.target.value }))}
                placeholder="Maadi, Zamalek…"
                className="w-full bg-input-dark border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-white text-sm placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </div>
        </div>

        {/* Bedrooms + Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium">Bedrooms</label>
            <div className="relative">
              <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <input
                type="number"
                min={0}
                value={prefs.bedrooms}
                onChange={(e) => setPrefs((p) => ({ ...p, bedrooms: e.target.value }))}
                placeholder="2"
                className="w-full bg-input-dark border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-white text-sm placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium">Type</label>
            <select
              value={prefs.property_type}
              onChange={(e) => setPrefs((p) => ({ ...p, property_type: e.target.value }))}
              className="w-full bg-input-dark border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all appearance-none capitalize"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Vibes */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 font-medium">Vibes</label>
          <div className="flex flex-wrap gap-2">
            {VIBE_OPTIONS.map((v) => {
              const active = prefs.vibes.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleVibe(v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? "bg-primary border-primary text-white"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-white/30"
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        onClick={() => onSubmit(prefs)}
        disabled={loading}
        className="mt-6 w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all shadow-lg shadow-primary/25"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Finding your matches…</>
        ) : (
          <><Sparkles className="h-4 w-4" /> Get AI Recommendations</>
        )}
      </button>
    </motion.div>
  );
}

// ── Recommendation card ──

function RecommendationCard({ listing }: { listing: RecommendedListing }) {
  const img =
    listing.images[0] ??
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800";

  return (
    <Link href={`/property/${listing.id}`}>
      <motion.div
        whileHover={{ y: -4 }}
        className="bg-card-dark rounded-2xl border border-white/10 overflow-hidden hover:border-primary/30 transition-colors"
      >
        <div className="relative h-44">
          <Image src={img} alt={listing.title} fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute bottom-3 left-3 text-white font-bold text-base">
            {formatEGP(listing.price)}
            <span className="text-xs font-normal text-gray-300">/month</span>
          </span>
        </div>
        <div className="p-4">
          <h4 className="text-white font-semibold text-sm truncate mb-1">{listing.title}</h4>
          <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" /> {listing.location}
          </p>
          {listing.reasoning && (
            <p className="text-xs text-primary/80 leading-relaxed line-clamp-2">
              ✨ {listing.reasoning}
            </p>
          )}
        </div>
      </motion.div>
    </Link>
  );
}

// ── Main section ──

export default function RecommendationsSection() {
  const user = useAuthStore((s) => s.user);

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RecommendedListing[] | null>(null);

  // Only show to logged-in users
  if (!user) return null;

  async function fetchRecommendations(prefs: Preferences) {
    setLoading(true);
    try {
      const res = await api.post<RecommendationsResponse>("/api/ai/recommendations", {
        budget_max: prefs.budget_max ? Number(prefs.budget_max) : null,
        location: prefs.location || null,
        bedrooms: prefs.bedrooms ? Number(prefs.bedrooms) : null,
        property_type: prefs.property_type || null,
        vibes: prefs.vibes,
        limit: 6,
      });
      setResults(res.recommendations ?? []);
      setShowModal(false);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold text-white">Picked for You</h2>
          </div>
          <p className="text-sm text-gray-400">
            AI-curated listings based on your preferences
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-sm shadow-lg shadow-primary/25 transition-all"
        >
          <Sparkles className="h-4 w-4" />
          {results ? "Update Preferences" : "Set Preferences"}
        </button>
      </div>

      {/* Preference modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <PreferenceModal
              onSubmit={fetchRecommendations}
              onClose={() => setShowModal(false)}
              loading={loading}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Results */}
      {loading && !showModal && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {results && results.length === 0 && (
        <p className="text-center text-gray-500 py-16">
          No matches found. Try adjusting your preferences.
        </p>
      )}

      {results && results.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {results.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <RecommendationCard listing={r} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Idle prompt */}
      {!results && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border border-dashed border-white/10 rounded-2xl">
          <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <p className="text-white font-semibold">Get personalized recommendations</p>
          <p className="text-sm text-gray-400 max-w-xs">
            Tell the AI your budget, preferred area, and lifestyle — it will find your best matches.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-sm transition-all shadow-lg shadow-primary/25"
          >
            Get Started
          </button>
        </div>
      )}
    </section>
  );
}
