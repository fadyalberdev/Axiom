import { DoorOpen, Users, Bath, Armchair } from "lucide-react";
import type { SharedHousingDetail } from "@/types";

interface SharedHousingStatsProps {
  housing: SharedHousingDetail;
}

const STAT_ICONS = {
  availability: DoorOpen,
  occupancy: Users,
  bathroom: Bath,
  furnishing: Armchair,
};

export default function SharedHousingStats({
  housing,
}: SharedHousingStatsProps) {
  const stats = [
    { key: "availability" as const, label: "Availability", value: housing.availability },
    { key: "occupancy" as const, label: "Occupancy", value: housing.occupancy },
    { key: "bathroom" as const, label: "Bathroom", value: housing.bathroom },
    { key: "furnishing" as const, label: "Furnishing", value: housing.furnishing },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-card-dark rounded-2xl border border-white/5">
      {stats.map((stat, i) => {
        const Icon = STAT_ICONS[stat.key];
        return (
          <div
            key={stat.key}
            className={`flex flex-col gap-1 ${i < stats.length - 1 ? "border-r border-white/5 pr-4" : ""}`}
          >
            <span className="text-gray-400 text-xs uppercase tracking-wider flex items-center gap-1">
              <Icon className="h-3.5 w-3.5" /> {stat.label}
            </span>
            <span className="text-white font-semibold">{stat.value}</span>
          </div>
        );
      })}
    </div>
  );
}
