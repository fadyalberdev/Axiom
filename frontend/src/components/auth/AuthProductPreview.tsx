import Image from "next/image";
import {
  Bath,
  BedDouble,
  Heart,
  Home,
  MapPin,
  MessageSquare,
  Ruler,
  Search,
  Sparkles,
} from "lucide-react";

type AuthProductPreviewMode = "signup" | "login";

interface AuthProductPreviewProps {
  mode: AuthProductPreviewMode;
}

const listing = {
  title: "Sunny apartment near Cairo Festival City",
  location: "New Cairo, Cairo",
  price: "EGP 18,500",
  image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&q=80",
  specs: [
    { icon: BedDouble, label: "2 Beds" },
    { icon: Bath, label: "2 Baths" },
    { icon: Ruler, label: "128 m2" },
  ],
};

const savedListings = [
  {
    title: "Garden studio",
    location: "Maadi",
    price: "EGP 11,200",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=500&q=80",
  },
  {
    title: "Shared room",
    location: "Nasr City",
    price: "EGP 5,800",
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=500&q=80",
  },
];

export default function AuthProductPreview({ mode }: AuthProductPreviewProps) {
  const isSignup = mode === "signup";

  return (
    <div className="hidden min-h-[660px] flex-col justify-between lg:flex">
      <div>
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
          {isSignup ? "Explore AXIOM" : "Return to AXIOM"}
        </div>
        <h1 className="mt-6 max-w-[570px] text-[4rem] font-black leading-[0.92] tracking-tight text-white">
          {isSignup ? "See the homes before you sign in." : "Your search is already waiting."}
        </h1>
        <p className="mt-6 max-w-[455px] text-base leading-7 text-white/58">
          {isSignup
            ? "The same listing cards, AI matches, and seller signals you will use inside the app."
            : "Jump back into saved homes, listing replies, and the dashboard view you already use."}
        </p>
      </div>

      <div className="relative max-w-[570px] rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-2 shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
        <div className="rounded-[1.35rem] border border-white/10 bg-[#151515] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
                {isSignup ? "Find homes preview" : "Dashboard preview"}
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {isSignup ? "Live listing surface" : "Saved homes"}
              </p>
            </div>
            <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {isSignup ? "AI match" : "2 saved"}
            </div>
          </div>

          {isSignup ? <SignupPreview /> : <LoginPreview />}
        </div>
      </div>
    </div>
  );
}

function SignupPreview() {
  return (
    <div className="grid grid-cols-[1.04fr_0.96fr] gap-3">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-dark">
        <div className="relative h-44 overflow-hidden bg-white/5">
          <Image
            src={listing.image}
            alt={listing.title}
            fill
            className="object-cover"
            sizes="360px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/10" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            <span className="rounded-md border border-primary/30 bg-primary px-2.5 py-1 text-[10px] font-black text-white">
              NEW
            </span>
            <span className="rounded-md border border-emerald-300/20 bg-emerald-300/15 px-2.5 py-1 text-[10px] font-black text-emerald-100">
              VERIFIED
            </span>
          </div>
          <div className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-primary">
            <Heart className="h-4 w-4 fill-current" />
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-black leading-snug text-white">
                {listing.title}
              </h3>
              <p className="mt-1.5 flex items-center gap-1 text-xs text-white/48">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{listing.location}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-sm font-black text-primary">{listing.price}</span>
              <span className="block text-[10px] text-white/36">/month</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-3 text-[11px] text-white/48">
            {listing.specs.map((spec) => {
              const Icon = spec.icon;
              return (
                <span key={spec.label} className="inline-flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5 text-white/34" />
                  {spec.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
            <Search className="h-3.5 w-3.5 text-primary" />
            Smart filters
          </div>
          <div className="space-y-2">
            {["New Cairo", "Apartment", "2 bedrooms"].map((chip) => (
              <div key={chip} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/72">
                {chip}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.08] p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
            <Sparkles className="h-3.5 w-3.5" />
            AI fit
          </div>
          <p className="text-3xl font-black text-white">91</p>
          <p className="mt-1 text-xs text-white/48">matches your search pattern</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
            <Home className="h-3.5 w-3.5 text-primary" />
            Property detail
          </div>
          <p className="text-xs leading-5 text-white/58">
            Opens into the same property page with photos, map, saved homes, and owner contact.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginPreview() {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        {savedListings.map((item) => (
          <div key={item.title} className="overflow-hidden rounded-2xl border border-white/10 bg-card-dark">
            <div className="relative h-28 overflow-hidden bg-white/5">
              <Image src={item.image} alt={item.title} fill className="object-cover" sizes="260px" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/10" />
              <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-primary">
                <Heart className="h-3.5 w-3.5 fill-current" />
              </div>
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-black text-white">{item.title}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-white/44">
                <MapPin className="h-3 w-3" />
                {item.location}
              </p>
              <p className="mt-2 text-sm font-black text-primary">{item.price}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[0.9fr_1.1fr] gap-3">
        <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
            Saved
          </p>
          <p className="mt-2 text-3xl font-black text-white">12</p>
          <p className="mt-1 text-xs text-white/48">homes in dashboard</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            Activity
          </div>
          <div className="space-y-2">
            {["Saved home updated", "Lead captured", "Application pending"].map((text) => (
              <div key={text} className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white/64">
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
