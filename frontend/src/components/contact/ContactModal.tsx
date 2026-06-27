"use client";

import { useState } from "react";
import { X, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
  /** Short context sent to support, e.g. "Agency plan enquiry". */
  subject?: string;
  title?: string;
  description?: string;
}

const inputClass =
  "w-full bg-input-dark border border-white/10 rounded-lg py-2.5 px-3 text-sm text-white focus:ring-primary focus:border-primary placeholder-gray-600 disabled:opacity-60";

export default function ContactModal({
  open,
  onClose,
  subject,
  title = "Contact us",
  description = "Tell us a bit about what you need and we'll get back to you.",
}: ContactModalProps) {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    if (submitting) return;
    setForm({ name: "", email: "", company: "", message: "" });
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error("Please fill in your name, email, and message.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post<{ sent: boolean }>("/api/contact", {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim() || null,
        message: form.message.trim(),
        subject: subject ?? null,
      });
      toast.success("Your message has been sent. We'll be in touch soon.");
      setForm({ name: "", email: "", company: "", message: "" });
      onClose();
    } catch (err) {
      let message = "Could not send your message. Please try again.";
      if (err instanceof ApiError) {
        const detail =
          typeof err.body === "object" && err.body !== null
            ? (err.body as { detail?: string }).detail
            : null;
        message = detail ?? message;
      } else if (
        err instanceof TypeError &&
        (err.message.includes("fetch") || err.message.includes("network"))
      ) {
        message = "Cannot reach the server. Make sure the backend is running.";
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={close} />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-card-dark p-6 shadow-2xl">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="absolute right-4 top-4 text-gray-500 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            {title}
          </h3>
          <p className="text-gray-400 text-xs mb-5">{description}</p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                disabled={submitting}
                placeholder="Your full name"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                disabled={submitting}
                placeholder="name@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Company <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                disabled={submitting}
                placeholder="Your company or agency"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Message</label>
              <textarea
                rows={4}
                required
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                disabled={submitting}
                placeholder="How can we help?"
                className={`${inputClass} resize-none`}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Sending…" : "Send message"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
