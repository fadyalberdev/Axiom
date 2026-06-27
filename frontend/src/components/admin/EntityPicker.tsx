"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { listItems } from "@/lib/admin/api";

interface EntityPickerProps {
  value: string;
  onChange: (id: string, label: string) => void;
  section: "users" | "agencies" | "projects" | "universities";
  placeholder?: string;
  displayValue?: string;
  extraParams?: Record<string, string>;
  disabled?: boolean;
}

interface Option {
  id: string;
  label: string;
}

function getLabel(item: Record<string, unknown>, section: string): string {
  if (section === "users") return `${item.full_name ?? item.email ?? item.id}`;
  if (section === "projects") return `${item.title ?? item.id}`;
  if (section === "universities") {
    const name = item.name ?? item.id;
    return item.city ? `${name} — ${item.city}` : `${name}`;
  }
  return `${item.name ?? item.id}`;
}

export default function EntityPicker({
  value,
  onChange,
  section,
  placeholder = "Search…",
  displayValue,
  extraParams,
  disabled = false,
}: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(displayValue ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await listItems<Record<string, unknown>>(section, {
          search,
          per_page: 8,
          ...extraParams,
        });
        setOptions(
          res.data.map((item) => ({
            id: String(item.id),
            label: getLabel(item, section),
          }))
        );
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [search, open, section, extraParams]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(opt: Option) {
    onChange(opt.id, opt.label);
    setSelectedLabel(opt.label);
    setOpen(false);
    setSearch("");
  }

  function clear() {
    onChange("", "");
    setSelectedLabel("");
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border text-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${disabled ? "bg-slate-50 border-slate-200 cursor-not-allowed opacity-60" : "bg-white border-slate-200 cursor-pointer hover:border-blue-400"}`}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className={`flex-1 truncate ${selectedLabel ? "text-slate-800" : "text-slate-400"}`}>
          {selectedLabel || placeholder}
        </span>
        {selectedLabel ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        )}
      </div>

      {value && (
        <p className="text-xs text-slate-400 mt-1 font-mono truncate">ID: {value}</p>
      )}

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${section}…`}
              className="w-full px-3 py-2 text-sm bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-xs text-slate-400 text-center">Searching…</div>
            ) : options.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400 text-center">No results</div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => select(opt)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition text-left"
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-slate-400 font-mono ml-2 flex-shrink-0">
                    {opt.id.slice(0, 8)}…
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
