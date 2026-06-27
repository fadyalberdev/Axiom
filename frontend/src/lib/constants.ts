import type {
  Feature,
  Testimonial,
  NavItem,
  FooterLink,
  HowItWorksStep,
} from "@/types";

export const NAV_ITEMS: NavItem[] = [

  { label: "Home", href: "/" },
  { label: "Find Homes", href: "/find-homes" },
  { label: "Agencies", href: "/agencies" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "About Us", href: "/about" },
];

export const FEATURES: Feature[] = [
  {
    icon: "Sparkles",
    title: "AI-Powered Matching",
    description:
      "Find roommates and homes that truly match your lifestyle and vibe using our proprietary algorithm.",
  },
  {
    icon: "BadgeCheck",
    title: "Verified Profiles",
    description:
      "Safety first. All users go through our rigorous verification process including ID checks.",
  },
  {
    icon: "Store",
    title: "Quality Listings",
    description:
      "Curated properties that meet our high quality standards for comfort, location and price.",
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "1",
    name: "Sarah Jenkins",
    subtitle: "Moved into The Mission Loft",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDP9htRA-NqUYvVw7A1ZbiJNNdEBy7s5kluqVzKpHu5Clf7wLxzaRhd_4yIzEZRTlEa8x34GStStdDUCPrUMhhS70hIrIcw2vgy_Ld0UKMCHEaps6_bZgvkJNYuQ_I7f_-PMQSSuahE-mdS0DIneumTpHxG70UlfkaLKrzvDoLrwn6K0BBt7mQtCe05qlLw7bvdHXDmcMHmMwDPYKeEBugJw7FQl1CKM2WKUYpN0EO9n3MT0s69wMnX7QWwShmO03yLwqO9QQtxaZ7n",
    rating: 5,
    quote:
      "I was skeptical about AI matching, but my roommates are literally my best friends now. The vibe check feature is shockingly accurate.",
  },
  {
    id: "2",
    name: "Marcus Chen",
    subtitle: "Host in NYC",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAGtYyx572Zsr52Kr1wck-92jc8G0126eZkP6VM8ismYxCj5tW-5H9PZ82txdmY7s4K3Hkxy5dVSmoosi6j_OtMocfZUZ2Wstmswr0Qh-QFdNXQQp5wrliXQN_YEgvqJeNIG-sieHP0y9OSuyzN8tmlAR9ot5qkjHrMmLVE-gaJakLIfLdydMO5cYId_WhLwbcxia2zVTa0wLyjaTAyd8AnIDR1BrYq5-FkoIcG3bSX8i2rLhF5EzsodOeNregbbXIkIm8d8zWhNGUf",
    rating: 5,
    quote:
      "Finding quality tenants used to be a nightmare. Axiom verified profiles gave me peace of mind instantly. Highly recommended.",
  },
  {
    id: "3",
    name: "Elena Rodriguez",
    subtitle: "Renting in Austin",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD9dVkaS4zjKTsaQDVypFOhzpmOAHtFHHMnx55zq4VhbBlkfAh0SnpHZssRMwlZetPk8-mItqowdyLYF3seuuK0lnFS9T8ct3jQSUP7f9iX5S8KVflGbqX7M5ReX5evaymuADNSZg9Sek77gohJcmW6Wf8lnvyBcUU0_mpukWd7O99kitNKwRWFGO6A-4VBOOjzZ63R5ic1RzqAjYU34TTJeoRtp70fdtX65-NYRphe5F6MRddeAjx0c7-oTe2ZG2eC2wqxQWJEnfO7",
    rating: 4.5,
    quote:
      "The interface is so smooth and the filters actually work. Found a place within 3 days of signing up. Smooth sailing!",
  },
];

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    number: "01",
    title: "Create Profile",
    description:
      "Share your lifestyle, habits, and what you're looking for. Our AI analyzes your vibe.",
  },
  {
    number: "02",
    title: "Get Matched",
    description:
      "We suggest homes and roommates with high compatibility scores. No more guessing games.",
  },
  {
    number: "03",
    title: "Connect & Move",
    description:
      "Chat securely, schedule tours, and sign leases all within the platform. Welcome home.",
  },
];

export const QUICK_LINKS: FooterLink[] = [
  { label: "Home", href: "/" },
  { label: "Search Listings", href: "/find-homes" },
  { label: "Agencies", href: "/agencies" },
  { label: "About Us", href: "/about" },
  { label: "Blog", href: "/blog" },
];

export const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
];

/* ── Listing form options ─────────────────────────────────── */

export const LISTING_CATEGORIES = [
  { value: "for_rent", label: "For Rent" },
  { value: "for_sale", label: "For Sale" },
  { value: "shared_housing", label: "Shared Housing" },
] as const;

export const PROPERTY_TYPES = [
  "Apartment",
  "Villa",
  "Studio",
  "Penthouse",
  "Duplex",
  "Townhouse",
  "Chalet",
  "Office",
  "Commercial",
  "Land",
] as const;

export const FURNISHING_OPTIONS = [
  "Furnished",
  "Semi-Furnished",
  "Unfurnished",
] as const;

export const LISTING_AMENITIES = [
  "Parking",
  "Swimming Pool",
  "Gym",
  "Garden",
  "Security",
  "Elevator",
  "Central AC",
  "Balcony",
  "Storage Room",
  "Maid's Room",
];
