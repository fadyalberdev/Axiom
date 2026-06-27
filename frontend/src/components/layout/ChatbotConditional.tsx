"use client";

import { usePathname } from "next/navigation";
import FloatingAIButton from "@/components/layout/FloatingAIButton";

const HIDDEN_PATHS = ["/login", "/signup", "/forgot-password", "/auth/", "/admin"];

export default function ChatbotConditional() {
  const pathname = usePathname();
  const hidden = HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p));
  if (hidden) return null;
  return <FloatingAIButton />;
}
