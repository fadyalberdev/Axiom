// V2/frontend/src/components/dashboard/DashboardProfile.tsx
"use client";

import Image from "next/image";
import { BadgeCheck, User } from "lucide-react";
import type { UserProfile } from "@/types";

interface DashboardProfileProps {
  user: UserProfile;
}

export default function DashboardProfile({ user }: DashboardProfileProps) {
  return (
    <div className="bg-card-dark rounded-3xl border border-white/5 p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
      <div className="relative flex-shrink-0">
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt={user.name}
            width={80}
            height={80}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/30"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/30">
            <User className="h-8 w-8 text-primary" />
          </div>
        )}
        {user.isVerifiedSeller && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center ring-2 ring-black">
            <BadgeCheck className="h-4 w-4 text-white" />
          </div>
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold text-white">{user.name}</h2>
          {user.isVerifiedSeller && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
              Verified Seller
            </span>
          )}
        </div>
        <p className="text-gray-400 text-sm mt-0.5">{user.subtitle}</p>
        <div className="flex flex-wrap gap-4 mt-3">
          {user.info.map((item) => (
            <div key={item.label} className="text-xs text-gray-500">
              <span className="text-gray-400 font-medium">{item.label}: </span>
              {item.value}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
