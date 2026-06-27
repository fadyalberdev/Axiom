"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, RotateCcw } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { ChatMessage, TypingIndicator, type ChatMessageData } from "./ChatMessage";
import type { Citation } from "@/types";

// ── Storage key — scoped per user so switching accounts clears the chat ──────
function getStorageKey(userId: string | undefined) {
  return userId ? `axiom_chat_${userId}` : "axiom_chat_guest";
}

// ── Session persistence helpers ───────────────────────────────────────────────
function loadSession(storageKey: string): { messages: ChatMessageData[]; sessionId: string | null } {
  if (typeof window === "undefined") return { messages: [], sessionId: null };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { messages: [], sessionId: null };
    const parsed = JSON.parse(raw);
    const messages: ChatMessageData[] = (parsed.messages ?? []).map(
      (m: Omit<ChatMessageData, "timestamp"> & { timestamp: string }) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })
    );
    return { messages, sessionId: parsed.sessionId ?? null };
  } catch {
    return { messages: [], sessionId: null };
  }
}

function saveSession(storageKey: string, messages: ChatMessageData[], sessionId: string | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify({ messages, sessionId }));
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Search intent detection (mirrors backend heuristic, client-side) ──────────
// Requires >= 2 signals so that a bare city name ("in cairo") doesn't falsely
// trigger the "Searching database..." header status.
function looksLikePropertySearch(text: string): boolean {
  const lower = text.toLowerCase();
  let signals = 0;
  if (/apartment|flat|villa|rent|sale|buy|buying|purchase|studio|penthouse|duplex|room|chalet|شقة|فيلا|إيجار|للبيع/.test(lower)) signals++;
  if (/cairo|giza|alex|maadi|zamalek|new cairo|sheikh zayed|october|heliopolis|nasr city|القاهرة|الجيزة|الإسكندرية|المعادي/.test(lower)) signals++;
  if (/show me|find me|looking for|i want|i need|أريد|ابحث/.test(lower)) signals++;
  if (/\d+\s*(egp|k\b|m\b|bedroom|bd\b|br\b|sqm|m2)/i.test(lower)) signals++;
  return signals >= 2;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const WELCOME_MESSAGE: ChatMessageData = {
  id: "welcome",
  role: "assistant",
  content:
    "مرحباً / Hello — I speak Arabic and English. Tell me what you're looking for and I'll search our live listings across Egypt for you.",
  timestamp: new Date(0),
};

const SUGGESTION_CHIPS = [
  {
    label: "🏠 Apartments in New Cairo",
    message: "Show me apartments for rent in New Cairo",
  },
  {
    label: "💰 Under 10,000 EGP/month",
    message: "What's available for rent under 10,000 EGP per month?",
  },
  {
    label: "🏘️ Compare neighborhoods",
    message: "What are the best neighborhoods in Cairo to live in?",
  },
] as const;

// ── Assistant status (replaces separate isTyping + isSearching) ───────────────
type AssistantStatus = "idle" | "searching" | "generating";

// ── Component ─────────────────────────────────────────────────────────────────
interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatDrawer({ isOpen, onClose }: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState("");
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>("idle");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const userId = useAuthStore((s) => s.session?.user?.id);
  const storageKey = getStorageKey(userId);
  const prevUserIdRef = useRef<string | undefined>(userId);

  // Reset chat when user switches accounts
  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      isLoadedRef.current = false;
      abortControllerRef.current?.abort();
      setAssistantStatus("idle");
      setMessages([]);
    }
  }, [userId]);

  // Load from localStorage on first open (or after user switch)
  useEffect(() => {
    if (isOpen && !isLoadedRef.current) {
      isLoadedRef.current = true;
      const { messages: saved } = loadSession(storageKey);
      setMessages(saved.length > 0 ? saved : [WELCOME_MESSAGE]);
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, storageKey]);

  // Abort any inflight request when drawer unmounts
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  // Persist to localStorage whenever messages change
  useEffect(() => {
    if (isLoadedRef.current) {
      saveSession(storageKey, messages, null);
    }
  }, [messages, storageKey]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, assistantStatus]);

  const handleClear = useCallback(() => {
    abortControllerRef.current?.abort();
    setAssistantStatus("idle");
    setMessages([WELCOME_MESSAGE]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || assistantStatus !== "idle") return;

    const userMsg: ChatMessageData = {
      id: makeId(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // B-1 FIX: build history from existing messages only — NOT including the current message.
    // The backend appends body.message itself; including it here would duplicate the turn.
    const recentMsgs = messages
      .filter((m) => m.id !== "welcome")
      .slice(-6);

    // M-2: Append compact listing summary to assistant history entries so the
    // LLM knows which listings were shown in prior turns ("the second one").
    const conversation_history = recentMsgs.map((m) => {
      let content = m.content;
      if (m.role === "assistant" && m.listing_refs && m.listing_refs.length > 0) {
        const summary = m.listing_refs
          .map((r, i) => `[${i + 1}] ${r.title} · ${r.location} · ${r.price.toLocaleString()} ${r.currency}`)
          .join("; ");
        content = `${content} [Listings shown: ${summary}]`;
      }
      return { role: m.role, content };
    });

    // I-1: Only show "Searching database..." when the query looks like a property search
    setAssistantStatus(looksLikePropertySearch(text) ? "searching" : "generating");

    const assistantMsgId = makeId();

    // M-1: AbortController — cancel any previous inflight request first
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const token = useAuthStore.getState().session?.access_token;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text, conversation_history }),
        signal: abortControllerRef.current.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";

      // Handle JSON fallback (ai_unavailable or error)
      if (contentType.includes("application/json")) {
        const json = await res.json();
        const content = json.ai_unavailable
          ? "AI is currently unavailable. Please try again later."
          : json.response ?? "Sorry, I couldn't generate a response.";
        setMessages((prev) => [
          ...prev,
          { id: assistantMsgId, role: "assistant", content, timestamp: new Date() },
        ]);
        return;
      }

      // SSE streaming
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      // Add empty assistant message to accumulate tokens into
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);

            if (parsed.token) {
              // First token means generation started — switch status from "searching"
              setAssistantStatus("generating");
              accumulated += parsed.token;
              const snap = accumulated;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: snap } : m,
                ),
              );
            }

            if (parsed.listing_refs) {
              // B-6: Store search_filters alongside listing_refs so ChatMessage can build filtered URL
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        listing_refs: parsed.listing_refs,
                        search_filters: parsed.search_filters,
                      }
                    : m,
                ),
              );
            }

            if (parsed.proximity_notice) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, proximity_notice: parsed.proximity_notice as string }
                    : m,
                ),
              );
            }

            if (parsed.citations) {
              const mappedCitations: Citation[] = (parsed.citations as Array<{
                source_type: string;
                source_id: string;
                title: string;
                url: string;
              }>).map((c) => ({
                sourceType: c.source_type as Citation["sourceType"],
                sourceId: c.source_id,
                title: c.title,
                url: c.url,
              }));
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, citations: mappedCitations } : m,
                ),
              );
            }

            if (parsed.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: parsed.error, isError: true, retryPayload: text }
                    : m,
                ),
              );
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      // M-1: Intentional abort (clear/close) — silently remove the empty assistant bubble
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        return;
      }

      // M-3: Network/other error — show error with retry button
      const errContent = "Sorry, I'm having trouble connecting right now.";
      setMessages((prev) => {
        const hasEmpty = prev.some((m) => m.id === assistantMsgId);
        if (hasEmpty) {
          return prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: errContent, isError: true, retryPayload: text }
              : m,
          );
        }
        return [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant",
            content: errContent,
            isError: true,
            retryPayload: text,
            timestamp: new Date(),
          },
        ];
      });
    } finally {
      setAssistantStatus("idle");
    }
  }, [input, assistantStatus, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isWorking = assistantStatus !== "idle";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 sm:hidden bg-black/50"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-[88px] right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-border bg-card"
            style={{ height: "min(560px, calc(100vh - 120px))" }}
          >
            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-primary/90 to-primary border-b border-primary/20 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-none">
                  AXIOM AI
                </p>
                <p className="text-xs text-white/70 mt-0.5 leading-none">
                  {assistantStatus === "searching"
                    ? "Searching database..."
                    : "Your Egyptian property expert"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleClear}
                  title="Clear chat"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onClose}
                  title="Close"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar min-h-0">
              {messages.map((msg) => (
                <div key={msg.id}>
                  <ChatMessage
                    message={msg}
                    onRetry={
                      msg.isError && msg.retryPayload
                        ? () => sendMessage(msg.retryPayload!)
                        : undefined
                    }
                  />

                  {/* Suggestion chips — only on fresh/cleared sessions */}
                  {msg.id === "welcome" && messages.length === 1 && (
                    <div className="flex flex-wrap gap-2 ml-9 mt-2">
                      {SUGGESTION_CHIPS.map((chip) => (
                        <button
                          key={chip.label}
                          onClick={() => sendMessage(chip.message)}
                          className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium border border-primary/20 transition-colors"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Citation pills */}
                  {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5 ml-2">
                      {msg.citations.slice(0, 3).map((citation) => (
                        <a
                          key={citation.sourceId}
                          href={citation.url}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors border border-primary/20 truncate max-w-[160px]"
                          title={citation.title}
                        >
                          <span className="truncate">{citation.title}</span>
                        </a>
                      ))}
                      {msg.citations.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                          +{msg.citations.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {isWorking && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Footer ── */}
            <div className="px-4 py-3 border-t border-border flex-shrink-0 bg-card">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about properties, prices, areas..."
                  disabled={isWorking}
                  className="flex-1 bg-secondary text-foreground text-sm rounded-full px-4 py-2.5 border border-border focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground disabled:opacity-50 transition-all"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isWorking}
                  className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-md shadow-primary/30"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
