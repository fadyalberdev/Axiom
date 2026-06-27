"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, Zap, Home, Users, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const tabs = [
  { id: "rent", label: "Rent", icon: Zap, placeholder: "City or neighborhood to rent in...", intent: "for rent" },
  { id: "buy", label: "Buy", icon: Home, placeholder: "City or neighborhood to buy in...", intent: "for sale" },
  { id: "roommates", label: "Roommates", icon: Users, placeholder: "City or neighborhood for shared housing...", intent: "roommates" },
] as const;

export default function HomeHero() {
  const [activeTab, setActiveTab] = useState<string>("rent");
  const [query, setQuery] = useState("");
  const router = useRouter();
  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  function handleSearch() {
    const q = query.trim();
    const combined = q ? `${q} ${currentTab.intent}` : currentTab.intent;
    router.push(`/find-homes?q=${encodeURIComponent(combined)}`);
  }

  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 bg-cover bg-center bg-[linear-gradient(to_bottom,rgba(18,18,18,0.3),rgba(18,18,18,0.95)),url('https://images.unsplash.com/photo-1600607686527-6fb886090705?ixlib=rb-4.0.3&auto=format&fit=crop&w=2400&q=80')]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto px-4 text-center relative z-10"
      >
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
          Find a home that <br className="hidden md:block" /> matches your{" "}
          <span className="text-primary">vibe.</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto font-light">
          Experience a new way to live together with AI-powered compatibility
          matching designed for modern living.
        </p>

        {/* Search Box */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 max-w-3xl mx-auto shadow-2xl">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 justify-center md:justify-start border-b border-white/10 pb-4 px-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isActive ? "text-white" : "hover:bg-white/10 text-gray-300"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="hero-tab-pill"
                      className="absolute inset-0 bg-primary rounded-full shadow-lg shadow-primary/20"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" /> {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input — morphs placeholder on tab change */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col md:flex-row gap-3"
            >
              <div className="relative flex-grow">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <MapPin className="h-5 w-5 text-primary" />
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder={currentTab.placeholder}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all hover:bg-black/60"
                />
              </div>
              <button
                onClick={handleSearch}
                className="bg-primary hover:bg-primary-hover text-white font-semibold py-3.5 px-8 rounded-xl transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Search className="h-5 w-5" /> Search
              </button>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Stats */}
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-gray-400 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Listings
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Roommates
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-primary">♥</span>  Match Rate
          </span>
        </div>

        {/* Trust badge */}

      </motion.div>
    </section>
  );
}
