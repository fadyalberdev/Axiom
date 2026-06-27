"use client";

import { formatEGP, getListingPriceSuffix } from "@/lib/utils";
import WhatsAppCTA from "@/components/property/WhatsAppCTA";

interface MobilePropertyCTAProps {
  price: number;
  category?: string;
  listingId: string;
  contactPhone?: string | null;
  contactName?: string | null;
}

export default function MobilePropertyCTA({
  price,
  category,
  listingId,
  contactPhone,
  contactName,
}: MobilePropertyCTAProps) {
  const suffix = getListingPriceSuffix(category);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0f0f0f]/95 backdrop-blur-md border-t border-white/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-0.5">
            <span className="text-white font-bold text-lg leading-none">
              {formatEGP(price)}
            </span>
            {suffix && <span className="text-gray-400 text-xs">{suffix}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <WhatsAppCTA
            listingId={listingId}
            contactPhone={contactPhone}
            contactName={contactName}
          />
        </div>
      </div>
    </div>
  );
}
