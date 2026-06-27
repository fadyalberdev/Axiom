"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import ContactModal from "@/components/contact/ContactModal";

export default function FooterContact() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors"
      >
        <Send className="h-3 w-3" />
        Contact Support
      </button>
      <ContactModal
        open={open}
        onClose={() => setOpen(false)}
        subject="Support enquiry"
        title="Contact support"
        description="Have a question or need help? Send us a message and our support team will get back to you."
      />
    </>
  );
}
