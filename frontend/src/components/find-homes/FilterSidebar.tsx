"use client";

import { SlidersHorizontal } from "lucide-react";

type FilterOption = {
  label: string;
  value: string;
};

const CATEGORY_OPTIONS: FilterOption[] = [
  { label: "Rent", value: "for_rent" },
  { label: "Sale", value: "for_sale" },
  { label: "Shared", value: "shared_housing" },
];

const PROPERTY_TYPE_OPTIONS: FilterOption[] = [
  { label: "Apartment", value: "apartment" },
  { label: "Villa", value: "villa" },
  { label: "Studio", value: "studio" },
  { label: "Duplex", value: "duplex" },
  { label: "Penthouse", value: "penthouse" },
  { label: "Townhouse", value: "townhouse" },
  { label: "Twin House", value: "twin_house" },
  { label: "Chalet", value: "chalet" },
  { label: "Office", value: "office" },
  { label: "Commercial", value: "commercial" },
  { label: "Land", value: "land" },
];

const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];
const BATHROOM_OPTIONS = [1, 2, 3, 4, 5];

const LEASE_OPTIONS: FilterOption[] = [
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

const ROOM_OPTIONS: FilterOption[] = [
  { label: "Private", value: "private" },
  { label: "Shared", value: "shared" },
  { label: "bathroom included", value: "ensuite" },
];

const AMENITIES = [
  "Parking",
  "Gym",
  "Security",
  "Elevator",
  "Garden",
  "Central AC",
  "Balcony",
  "Swimming Pool",
  "Furnished",
  "Rooftop",
  "Pet Friendly",
  "CCTV",
  "Doorman",
] as const;

export interface FilterValues {
  category: string;
  propertyType: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number[];
  bathrooms?: number[];
  minSize?: number;
  maxSize?: number;
  leaseType: string;
  roomType: string;
  utilitiesIncluded?: boolean;
  amenities: string[];
}

interface FilterSidebarProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onApply?: (filters: FilterValues) => void;
  onReset?: () => void;
}

const EMPTY_FILTERS: FilterValues = {
  category: "",
  propertyType: "",
  leaseType: "",
  roomType: "",
  amenities: [],
};

export { EMPTY_FILTERS };

function numberValue(value?: number) {
  return value == null ? "" : String(value);
}

function toNumber(value: string) {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function FilterSidebar({
  values,
  onChange,
  onApply,
  onReset,
}: FilterSidebarProps) {
  const update = (patch: Partial<FilterValues>) => onChange({ ...values, ...patch });

  const toggleAmenity = (amenity: string) => {
    const next = values.amenities.includes(amenity)
      ? values.amenities.filter((item) => item !== amenity)
      : [...values.amenities, amenity];
    update({ amenities: next });
  };

  const handleReset = () => {
    onChange(EMPTY_FILTERS);
    onReset?.();
  };

  const handleApply = () => onApply?.(values);

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-surface p-6 custom-scrollbar">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <SlidersHorizontal className="h-4 w-4 text-primary" /> Filters
        </h2>
        <button
          onClick={handleReset}
          aria-label="Reset all filters"
          className="text-xs font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          Reset All
        </button>
      </div>

      <div className="flex-1 space-y-6">
        <FilterSection title="Category">
          <SegmentedOptions
            options={CATEGORY_OPTIONS}
            value={values.category}
            onChange={(category) => update({ category })}
          />
        </FilterSection>

        <FilterSection title="Property Type">
          <ChipGrid
            options={PROPERTY_TYPE_OPTIONS}
            value={values.propertyType}
            onChange={(propertyType) => update({ propertyType })}
          />
        </FilterSection>

        <FilterSection title="Price Range (EGP)">
          <RangeInputs
            minLabel="Min price"
            maxLabel="Max price"
            minValue={values.minPrice}
            maxValue={values.maxPrice}
            onMinChange={(minPrice) => update({ minPrice })}
            onMaxChange={(maxPrice) => update({ maxPrice })}
          />
        </FilterSection>

        <FilterSection title="Rooms">
          <div className="space-y-4">
            <NumberChips
              label="Bedrooms"
              options={BEDROOM_OPTIONS}
              value={values.bedrooms}
              onChange={(bedrooms) => update({ bedrooms })}
            />
            <NumberChips
              label="Bathrooms"
              options={BATHROOM_OPTIONS}
              value={values.bathrooms}
              onChange={(bathrooms) => update({ bathrooms })}
            />
          </div>
        </FilterSection>

        <FilterSection title="Size (sqm)">
          <RangeInputs
            minLabel="Min size"
            maxLabel="Max size"
            minValue={values.minSize}
            maxValue={values.maxSize}
            onMinChange={(minSize) => update({ minSize })}
            onMaxChange={(maxSize) => update({ maxSize })}
          />
        </FilterSection>

        <FilterSection title="Rental Details">
          <ChipGrid
            options={LEASE_OPTIONS}
            value={values.leaseType}
            onChange={(leaseType) => update({ leaseType })}
          />
        </FilterSection>

        <FilterSection title="Shared Housing">
          <div className="space-y-4">
            <ChipGrid
              options={ROOM_OPTIONS}
              value={values.roomType}
              onChange={(roomType) => update({ roomType })}
            />
            <ToggleRow
              label="Utilities included"
              checked={values.utilitiesIncluded === true}
              onChange={(checked) => update({ utilitiesIncluded: checked ? true : undefined })}
            />
          </div>
        </FilterSection>

        <FilterSection title="Amenities">
          <div className="grid grid-cols-1 gap-3">
            {AMENITIES.map((amenity) => (
              <label key={amenity} className="group flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={values.amenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                  className="custom-checkbox h-4 w-4 rounded border-white/20 bg-input-dark text-primary focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-sm text-gray-400 transition-colors group-hover:text-white">
                  {amenity}
                </span>
              </label>
            ))}
          </div>
        </FilterSection>
      </div>

      <div className="mt-2 border-t border-white/5 pt-6">
        <button
          onClick={handleApply}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover active:scale-[0.98]"
        >
          Apply Filters
        </button>
      </div>
    </aside>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-card-dark p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-300">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SegmentedOptions({
  options,
  value,
  onChange,
}: {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(value === option.value ? "" : option.value)}
          className={`rounded-lg border px-2 py-2.5 text-xs font-semibold transition-all active:scale-[0.98] ${
            value === option.value
              ? "border-primary bg-primary text-white"
              : "border-white/10 bg-input-dark text-gray-300 hover:border-primary/60 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ChipGrid({
  options,
  value,
  onChange,
}: {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(value === option.value ? "" : option.value)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === option.value
              ? "border-primary bg-primary text-white"
              : "border-white/20 bg-transparent text-gray-400 hover:border-primary hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function NumberChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: number[];
  value?: number[];
  onChange: (value?: number[]) => void;
}) {
  const selected = value ?? [];
  const toggle = (option: number) => {
    const next = selected.includes(option)
      ? selected.filter((v) => v !== option)
      : [...selected, option];
    onChange(next.length > 0 ? next : undefined);
  };
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`h-8 min-w-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
              selected.includes(option)
                ? "border-primary bg-primary text-white"
                : "border-white/20 bg-transparent text-gray-400 hover:border-primary hover:text-white"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeInputs({
  minLabel,
  maxLabel,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: {
  minLabel: string;
  maxLabel: string;
  minValue?: number;
  maxValue?: number;
  onMinChange: (value?: number) => void;
  onMaxChange: (value?: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="space-y-1.5">
        <span className="text-[11px] font-medium text-gray-500">{minLabel}</span>
        <input
          type="number"
          value={numberValue(minValue)}
          onChange={(event) => onMinChange(toNumber(event.target.value))}
          placeholder="Any"
          className="w-full rounded-md border border-white/10 bg-input-dark px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-primary focus:ring-primary"
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-[11px] font-medium text-gray-500">{maxLabel}</span>
        <input
          type="number"
          value={numberValue(maxValue)}
          onChange={(event) => onMaxChange(toNumber(event.target.value))}
          placeholder="Any"
          className="w-full rounded-md border border-white/10 bg-input-dark px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-primary focus:ring-primary"
        />
      </label>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-input-dark px-3 py-2.5">
      <span className="text-sm font-medium text-gray-300">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="custom-checkbox h-4 w-4 rounded border-white/20 bg-input-dark text-primary focus:ring-0 focus:ring-offset-0"
      />
    </label>
  );
}
