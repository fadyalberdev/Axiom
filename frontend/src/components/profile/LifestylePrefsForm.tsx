"use client";

import type { ListingLifestylePreferences } from "@/types/api";

type Props = {
  value: ListingLifestylePreferences;
  onChange: (value: ListingLifestylePreferences) => void;
  disabled?: boolean;
  compact?: boolean;
};

const SELECT_FIELDS = [
  {
    key: "gender_preference",
    label: "Gender preference",
    options: [
      ["", "Select preference"],
      ["male", "Male"],
      ["female", "Female"],
    ],
  },
  {
    key: "guests_policy",
    label: "Guests policy",
    options: [
      ["", "Select policy"],
      ["flexible", "Flexible"],
      ["rarely", "Rarely"],
      ["never", "Never"],
    ],
  },
  {
    key: "noise_level",
    label: "Noise level",
    options: [
      ["", "Select level"],
      ["quiet", "Quiet"],
      ["moderate", "Moderate"],
      ["lively", "Lively"],
    ],
  },
  {
    key: "cleanliness",
    label: "Cleanliness",
    options: [
      ["", "Select style"],
      ["very_clean", "Very clean"],
      ["average", "Average"],
      ["relaxed", "Relaxed"],
    ],
  },
  {
    key: "sleep_schedule",
    label: "Sleep schedule",
    options: [
      ["", "Select schedule"],
      ["early_bird", "Early bird"],
      ["night_owl", "Night owl"],
      ["flexible", "Flexible"],
    ],
  },
  {
    key: "occupation_type",
    label: "Occupation type",
    options: [
      ["", "Select type"],
      ["student", "Student"],
      ["professional", "Professional"],
      ["any", "Any"],
    ],
  },
] as const;

const TOGGLE_FIELDS = [
  { key: "smoking_allowed", label: "Smoking allowed" },
  { key: "pets_allowed", label: "Pets allowed" },
] as const;

export default function LifestylePrefsForm({
  value,
  onChange,
  disabled = false,
  compact = false,
}: Props) {
  const filled = [
    value.gender_preference,
    value.smoking_allowed,
    value.pets_allowed,
    value.guests_policy,
    value.noise_level,
    value.cleanliness,
    value.sleep_schedule,
    value.occupation_type,
  ].filter((item) => item !== undefined && item !== null && String(item) !== "").length;
  const complete = filled === 8;

  function setValue<K extends keyof ListingLifestylePreferences>(
    key: K,
    next: ListingLifestylePreferences[K]
  ) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className={compact ? "space-y-4" : "rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-5"}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Application Preferences</h3>
          <p className="text-xs text-gray-400">{filled} of 8 preferences filled</p>
        </div>
        <span
          className={
            complete
              ? "rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300"
              : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-300"
          }
        >
          {complete ? "Profile complete" : "In progress"}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(filled / 8) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {SELECT_FIELDS.map((field) => (
          <label key={field.key} className="space-y-1.5 text-sm">
            <span className="text-xs font-medium text-gray-300">{field.label}</span>
            <select
              disabled={disabled}
              value={(value[field.key] as string | null | undefined) ?? ""}
              onChange={(event) =>
                setValue(
                  field.key,
                  (event.target.value || null) as never
                )
              }
              className="w-full rounded-xl border border-white/10 bg-input-dark px-3 py-2.5 text-sm text-white outline-none transition focus:border-primary disabled:opacity-60"
            >
              {field.options.map(([optionValue, label]) => (
                <option key={optionValue} value={optionValue}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {TOGGLE_FIELDS.map((field) => {
          const active = value[field.key] === true;
          return (
            <button
              key={field.key}
              type="button"
              disabled={disabled}
              onClick={() => setValue(field.key, !active)}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-input-dark px-4 py-3 text-left transition hover:border-white/25 disabled:opacity-60"
            >
              <span className="text-sm font-medium text-gray-200">{field.label}</span>
              <span
                className={
                  active
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-bold text-white"
                    : "rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-gray-300"
                }
              >
                {active ? "Yes" : "No"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
