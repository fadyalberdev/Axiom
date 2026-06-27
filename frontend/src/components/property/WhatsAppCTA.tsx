"use client";

import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { useRouter, usePathname } from "next/navigation";
import { api, ApiError } from "@/lib/api";

interface WhatsAppCTAProps {
  listingId: string;
  contactPhone: string | null | undefined;
  contactName: string | null | undefined;
}

async function openWhatsApp(
  listingId: string,
): Promise<void> {
  const data = await api.post<{ whatsapp_url: string; already_existed: boolean }>(
    "/api/leads",
    { listing_id: listingId, source: "whatsapp_click" },
  );
  window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
}

export default function WhatsAppCTA({
  listingId,
  contactPhone,
  contactName,
}: WhatsAppCTAProps) {
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  if (!contactPhone) {
    return (
      <div className="text-center text-sm text-gray-500 py-3">
        Contact information unavailable
      </div>
    );
  }

  function requireAuth(action: () => void) {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    action();
  }

  async function handleClick() {
    requireAuth(async () => {
      setLoading(true);
      try {
        await openWhatsApp(listingId);
      } catch (err) {
        let message = "Could not open WhatsApp. Please try again.";
        if (err instanceof ApiError) {
          const detail =
            typeof err.body === "object" && err.body !== null
              ? (err.body as { detail?: string }).detail
              : null;
          message = detail ?? message;
        } else if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network"))) {
          message = "Cannot reach the server. Make sure the backend is running.";
        }
        toast.error(message);
      } finally {
        setLoading(false);
      }
    });
  }

  return (
    <div className="space-y-3">
      {contactName && (
        <p className="text-xs text-gray-500 text-center">
          Contacting: <span className="text-gray-300">{contactName}</span>
        </p>
      )}

      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-[background-color,opacity,transform] duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        Contact via WhatsApp
      </button>
    </div>
  );
}
