"use client";

interface GoogleMapEmbedProps {
  address: string;
  title: string;
  lat?: number | null;
  lng?: number | null;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

// Uses the Google Maps Embed API (requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY with
// the "Maps Embed API" enabled). Prefers exact coordinates when available,
// otherwise geocodes the address text.
export default function GoogleMapEmbed({ address, title, lat, lng }: GoogleMapEmbedProps) {
  const q = lat != null && lng != null ? `${lat},${lng}` : address;
  const src = `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${encodeURIComponent(q)}`;

  return (
    <iframe
      src={src}
      title={title}
      width="100%"
      height="100%"
      style={{ border: 0 }}
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
