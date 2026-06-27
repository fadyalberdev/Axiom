"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProjectDetail } from "@/types";
import { api, ApiError } from "@/lib/api";

interface ProjectSidebarProps {
  project: ProjectDetail;
}

const inputClass =
  "w-full bg-input-dark border border-white/10 rounded-lg py-2.5 px-3 text-sm text-white focus:ring-primary focus:border-primary placeholder-gray-600 disabled:opacity-60";

export default function ProjectSidebar({ project }: ProjectSidebarProps) {
  const agentInitials = project.salesAgent.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    interested_in: project.residenceOptions[0] ?? "",
  });
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Please fill in your name, email, and phone.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post<{ sent: boolean }>(`/api/projects/${project.id}/contact`, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        interested_in: form.interested_in || null,
      });
      toast.success("Your enquiry has been sent. The sales team will be in touch.");
      setForm({
        name: "",
        email: "",
        phone: "",
        interested_in: project.residenceOptions[0] ?? "",
      });
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-6 sticky top-24"
    >
      {/* Contact form */}
      <div className="bg-card-dark rounded-2xl p-6 border border-white/5">
        <h3 className="text-lg font-bold text-white mb-6">
          Contact Sales Team
        </h3>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative shrink-0">
            {project.salesAgent.avatar ? (
              <Image
                src={project.salesAgent.avatar}
                alt={project.salesAgent.name}
                width={48}
                height={48}
                className="rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm">
                {agentInitials}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-card-dark" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm">
              {project.salesAgent.name}
            </p>
            <p className="text-gray-500 text-xs">{project.salesAgent.role}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Name
            </label>
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
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Email
            </label>
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
              Phone
            </label>
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
          {project.residenceOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Interested In
              </label>
              <select
                value={form.interested_in}
                onChange={(e) => update("interested_in", e.target.value)}
                disabled={submitting}
                className={inputClass}
              >
                {project.residenceOptions.map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white py-3 rounded-lg font-medium transition-colors mt-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Sending…" : "Request Private Tour"}
          </button>
          <p className="text-[10px] text-gray-500 text-center mt-2">
            By clicking, you agree to our Terms & Privacy Policy.
          </p>
        </form>
      </div>
    </motion.div>
  );
}
