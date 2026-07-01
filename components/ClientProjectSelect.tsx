"use client";

import {
  BAGO_CLIENT_PROJECT_OPTIONS,
  type ClientProjectOption,
} from "@/lib/project-profiles";
import { RequiredMark } from "./RequiredMark";

const fieldClasses =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] " +
  "shadow-[0_1px_2px_rgba(15,15,15,0.04)] outline-none transition " +
  "focus:border-[#b9b9b7] focus:ring-2 focus:ring-[#2383e2]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

interface ClientProjectSelectProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  options?: ClientProjectOption[];
}

export function ClientProjectSelect({
  id = "clientProject",
  name = "clientProject",
  value,
  onChange,
  disabled = false,
  hint,
  options = BAGO_CLIENT_PROJECT_OPTIONS,
}: ClientProjectSelectProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClasses}>
        Proyecto Cliente
        <RequiredMark />
      </label>
      <select
        id={id}
        name={name}
        required
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClasses}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-[#9b9a97]">{hint}</p>}
    </div>
  );
}
