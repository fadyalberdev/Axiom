"use client";

import { MapPin } from "lucide-react";
import GoogleMapEmbed from "./GoogleMapEmbed";

interface PropertyMapProps {
  title: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
}

export default function PropertyMap({ title, address, lat, lng }: PropertyMapProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Location</h2>

      <div className="flex items-start gap-2 text-gray-400 text-sm">
        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <span>{address}</span>
      </div>

      <div className="rounded-2xl overflow-hidden border border-white/10 h-72">
        <GoogleMapEmbed address={address} title={title} lat={lat} lng={lng} />
      </div>
    </div>
  );
}
