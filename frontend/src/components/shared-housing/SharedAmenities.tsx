"use client";

import React from "react";
import {
  Lock,
  Users,
  Bed,
  DoorOpen,
  Monitor,
  CookingPot,
  Bath,
  WashingMachine,
  Wifi,
  Tv,
  Car,
  Snowflake,
  Shield,
  CheckCircle,
  Coffee,
  Dumbbell,
  Waves,
  Zap,
  Package,
  Phone,
  Wind,
} from "lucide-react";
import type { SharedAmenity } from "@/types";

const LABEL_ICON_MAP: [RegExp, React.ElementType][] = [
  [/bed|bedroom/i, Bed],
  [/door|room/i, DoorOpen],
  [/monitor|desk|tv|television/i, Monitor],
  [/cook|kitchen/i, CookingPot],
  [/bath|shower/i, Bath],
  [/wash|laundry/i, WashingMachine],
  [/wifi|internet|fiber/i, Wifi],
  [/air|ac|conditioning/i, Snowflake],
  [/parking|garage|car/i, Car],
  [/pool|swim/i, Waves],
  [/gym|fitness|dumbbell/i, Dumbbell],
  [/security|guard|cctv/i, Shield],
  [/tv|netflix|streaming/i, Tv],
  [/generator|power|electric/i, Zap],
  [/storage|archive/i, Package],
  [/phone|mobile/i, Phone],
  [/balcony|terrace|rooftop/i, Wind],
  [/coffee|café/i, Coffee],
];

function getIcon(label: string): React.ElementType {
  for (const [pattern, Icon] of LABEL_ICON_MAP) {
    if (pattern.test(label)) return Icon;
  }
  return CheckCircle;
}

interface SharedAmenitiesProps {
  privateAmenities: SharedAmenity[];
  sharedAmenities: SharedAmenity[];
}

function AmenityItem({ amenity }: { amenity: SharedAmenity }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-card-dark rounded-xl border border-white/5 hover:border-white/10 transition-colors">
      {React.createElement(getIcon(amenity.label), { className: "h-4 w-4 text-primary flex-shrink-0" })}
      <span className="text-gray-300 text-sm">{amenity.label}</span>
    </div>
  );
}

export default function SharedAmenities({
  privateAmenities,
  sharedAmenities,
}: SharedAmenitiesProps) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Amenities</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4" /> Private Features
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            Room-only features reserved for the person taking this spot.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {privateAmenities.length > 0 ? (
              privateAmenities.map((a) => <AmenityItem key={a.label} amenity={a} />)
            ) : (
              <p className="rounded-xl border border-white/5 bg-card-dark p-3 text-sm text-gray-500">
                No private room-only features listed
              </p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" /> Shared Features
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            Home and building features included with the shared space.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {sharedAmenities.length > 0 ? (
              sharedAmenities.map((a) => <AmenityItem key={a.label} amenity={a} />)
            ) : (
              <p className="text-gray-500 text-sm">None listed</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
