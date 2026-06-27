"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

interface Props {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  eyebrow?: string;
  description?: string;
}

export default function AdminModal({
  title,
  open,
  onClose,
  children,
  width = "max-w-lg",
  eyebrow = "Admin action",
  description,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handler);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-[1.75rem] border border-zinc-800 bg-zinc-100 shadow-[0_44px_140px_-45px_rgba(0,0,0,0.95)] ring-1 ring-white/20`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-zinc-950 px-6 py-5 text-white">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-300">{eyebrow}</p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-white">{title}</h2>
            {description && <p className="mt-1 text-sm leading-5 text-zinc-400">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition-[background-color,color,transform] hover:bg-white/10 hover:text-white active:scale-[0.97]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
