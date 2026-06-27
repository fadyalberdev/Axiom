"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { BadgeCheck, GraduationCap, Globe, Share2, Mail, MessageCircle, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { UniversityDetail } from "@/types";
import { api, ApiError } from "@/lib/api";

interface UniversitySidebarProps {
  university: UniversityDetail;
}

const inputClass =
  "w-full bg-input-dark border border-white/10 rounded-lg py-2.5 px-3 text-sm text-white focus:ring-primary focus:border-primary placeholder-gray-600 disabled:opacity-60";

export default function UniversitySidebar({ university }: UniversitySidebarProps) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Please fill in your name, email, and phone.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post<{ sent: boolean }>(`/api/universities/${university.id}/contact`, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim() || null,
      });
      toast.success("Your enquiry has been sent. The university will be in touch.");
      setForm({ name: "", email: "", phone: "", message: "" });
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

  function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: university.name, url: window.location.href });
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  }

  const foundedYear = university.founded_year;
  const age = foundedYear
    ? `${new Date().getFullYear() - foundedYear} yrs`
    : university.created_at
    ? `${new Date().getFullYear() - new Date(university.created_at).getFullYear()} yrs`
    : "N/A";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-6 sticky top-24"
    >
      {/* Main info card */}
      <div className="bg-card-dark rounded-2xl p-6 border border-white/10 shadow-xl">
        {/* Logo + name + badge */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center border border-white/10 shrink-0 shadow-lg overflow-hidden">
            {university.logo_url ? (
              <Image
                src={university.logo_url}
                alt={`${university.name} logo`}
                width={64}
                height={64}
                className="object-contain w-full h-full"
                unoptimized
              />
            ) : (
              <GraduationCap className="h-7 w-7 text-primary" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{university.name}</h2>
            <div className="inline-flex items-center gap-1 mt-1.5 bg-primary/15 border border-primary/30 rounded-md px-2 py-0.5">
              <BadgeCheck className="h-3 w-3 text-primary shrink-0" />
              <span className="text-primary text-[10px] font-bold uppercase tracking-wider">
                {university.verified ? "Verified University" : "Partner University"}
              </span>
            </div>
          </div>
        </div>

        {university.description && (
          <p className="text-gray-400 text-sm leading-relaxed mb-5">{university.description}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3">
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="text-2xl font-bold text-white mb-0.5">{university.trust_score}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Trust Score</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="text-2xl font-bold text-white mb-0.5">{university.listings_count}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Active Listings</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-5">
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-1 mb-0.5">
              <Users className="h-4 w-4 text-primary" />
              <div className="text-xl font-bold text-white">
                {university.student_count != null
                  ? university.student_count >= 1000
                    ? `${(university.student_count / 1000).toFixed(0)}k+`
                    : university.student_count.toLocaleString()
                  : "N/A"}
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Students</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="text-xl font-bold text-white mb-0.5 capitalize">
              {university.type ?? "N/A"}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">University Type</div>
          </div>
        </div>

        {/* Extra info rows */}
        {(university.accreditation || university.founded_year) && (
          <div className="space-y-2 mb-5">
            {university.accreditation && (
              <div className="flex justify-between items-center text-sm py-2 border-b border-white/5">
                <span className="text-gray-400">Accreditation</span>
                <span className="text-white font-medium text-xs text-right max-w-[160px] truncate">
                  {university.accreditation}
                </span>
              </div>
            )}
            {university.founded_year && (
              <div className="flex justify-between items-center text-sm py-2">
                <span className="text-gray-400">Est.</span>
                <span className="text-white font-medium">
                  {university.founded_year} ({age} old)
                </span>
              </div>
            )}
          </div>
        )}

        {/* CTA buttons */}
        <button
          onClick={handleShare}
          className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mb-3 cursor-pointer"
        >
          <Share2 className="h-4 w-4" />
          Share University
        </button>
        {university.website ? (
          <a
            href={university.website}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-white/15 hover:border-white/30 hover:bg-white/5 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-5"
          >
            <Globe className="h-4 w-4" />
            Visit Official Website
          </a>
        ) : (
          <button
            disabled
            className="w-full border border-white/10 text-white/30 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 mb-5 cursor-not-allowed"
          >
            <Globe className="h-4 w-4" />
            Visit Official Website
          </button>
        )}

        {/* Contact icons */}
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5">
          {university.website ? (
            <a
              href={university.website}
              target="_blank"
              rel="noopener noreferrer"
              title="Website"
              className="w-9 h-9 bg-white/5 hover:bg-primary/15 hover:text-primary rounded-lg flex items-center justify-center text-gray-400 transition-all"
            >
              <Globe className="h-4 w-4" />
            </a>
          ) : (
            <button
              disabled
              title="No website"
              className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center text-gray-600 cursor-not-allowed"
            >
              <Globe className="h-4 w-4" />
            </button>
          )}

          {university.phone ? (
            <a
              href={`tel:${university.phone}`}
              title={university.phone}
              className="w-9 h-9 bg-white/5 hover:bg-primary/15 hover:text-primary rounded-lg flex items-center justify-center text-gray-400 transition-all"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          ) : (
            <button
              disabled
              title="No phone"
              className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center text-gray-600 cursor-not-allowed"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          )}

          {university.email ? (
            <a
              href={`mailto:${university.email}`}
              title={university.email}
              className="w-9 h-9 bg-white/5 hover:bg-primary/15 hover:text-primary rounded-lg flex items-center justify-center text-gray-400 transition-all"
            >
              <Mail className="h-4 w-4" />
            </a>
          ) : (
            <button
              onClick={handleShare}
              title="Share"
              className="w-9 h-9 bg-white/5 hover:bg-primary/15 hover:text-primary rounded-lg flex items-center justify-center text-gray-400 transition-all cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contact form */}
      <div className="bg-card-dark rounded-2xl p-6 border border-white/10 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Contact University
        </h3>
        <p className="text-gray-400 text-xs mb-5">
          Ask about student housing near {university.name}.
        </p>

        <form className="space-y-4" onSubmit={handleContactSubmit}>
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
            <label className="block text-xs font-medium text-gray-400 mb-1">Phone</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              disabled={submitting}
              placeholder="+20 100 000 0000"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Message <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
              disabled={submitting}
              placeholder="What would you like to know?"
              className={`${inputClass} resize-none`}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white py-3 rounded-xl font-bold transition-colors"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Sending…" : "Send Enquiry"}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
