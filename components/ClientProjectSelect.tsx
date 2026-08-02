"use client";

import {
  BAGO_CLIENT_PROJECT_OPTIONS,
  type ClientProjectOption,
} from "@/lib/project-profiles";
import { RequiredMark } from "./RequiredMark";

const fieldClasses =
  "w-full rounded-xl border border-[#d5e3ec] bg-white px-3.5 py-3 text-sm text-[#173b59] " +
  "shadow-[0_1px_2px_rgba(65,28,51,0.03)] outline-none transition duration-200 " +
  "hover:border-[#9bbdd2] focus:border-[#1a6999] focus:ring-4 focus:ring-[#1a6999]/10 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const labelClasses = "mb-2 block text-sm font-semibold text-[#203d58]";

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
