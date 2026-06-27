"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

// Lazy-load the drawer so it doesn't bloat the initial bundle
const ChatDrawer = dynamic(
  () => import("@/components/ai/ChatDrawer").then((m) => ({ default: m.ChatDrawer })),
  { ssr: false }
);

export default function FloatingAIButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating trigger button */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Pulse ring — only when closed */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
        )}

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => setIsOpen((v) => !v)}
          aria-label={isOpen ? "Close AI chat" : "Open AI chat"}
          className="relative w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 flex items-center justify-center transition-colors"
        >
          <motion.div
            key={isOpen ? "close" : "open"}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            {isOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </motion.div>
        </motion.button>
      </div>

      {/* Chat drawer */}
      <ChatDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
