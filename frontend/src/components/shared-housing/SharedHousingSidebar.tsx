"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import type { SharedHousingDetail } from "@/types";
import WhatsAppCTA from "@/components/property/WhatsAppCTA";
import { formatEGP } from "@/lib/utils";

interface SharedHousingSidebarProps {
  housing: SharedHousingDetail;
  contactPhone?: string | null;
  contactName?: string | null;
}

export default function SharedHousingSidebar({
  housing,
  contactPhone,
  contactName,
}: SharedHousingSidebarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="sticky top-24 space-y-6"
    >
      {/* Price card */}
      <div className="bg-card-dark rounded-2xl p-6 border border-white/10 shadow-2xl shadow-black/50">
        <div className="flex justify-between items-end mb-6 pb-6 border-b border-white/5">
          <div>
            <span className="text-3xl font-bold text-white">
              {formatEGP(housing.price)}
            </span>
            <span className="text-gray-400 text-sm font-medium">/month</span>
          </div>
          {housing.utilitiesIncluded && (
            <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
              Bills included
            </span>
          )}
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Availability</span>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-white">
                {housing.availableDate}
              </span>
            </div>
          </div>

          <WhatsAppCTA
            listingId={housing.id}
            contactPhone={contactPhone}
            contactName={contactName}
          />
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-4">
          <ShieldCheck className="h-4 w-4" />
          <span>Secure verification via Axiom Shield</span>
        </div>
      </div>

      {/* Similar rooms */}
      {housing.similarRooms.length > 0 && (
        <div className="bg-card-dark rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-white font-bold text-sm">Similar Rooms</h3>
          </div>
          <div className="divide-y divide-white/5">
            {housing.similarRooms.map((room) => (
              <Link
                key={room.id}
                href={`/shared-housing/${room.id}`}
                className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group"
              >
                {room.image && (
                  <Image
                    src={room.image}
                    alt={room.title}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h4 className="text-white text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {room.title}
                  </h4>
                  <p className="text-white text-sm font-bold mt-1">
                    {formatEGP(room.price)}/month
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div className="p-4 bg-white/5">
            <Link
              href="/find-homes"
              className="w-full block text-center text-xs text-primary font-bold hover:underline"
            >
              View All Listings
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}
