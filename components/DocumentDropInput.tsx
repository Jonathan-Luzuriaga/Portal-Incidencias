"use client";

import { useCallback, useId, useRef, useState } from "react";
import { RequiredMark } from "./RequiredMark";

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const labelClasses = "mb-2 block text-sm font-semibold text-[#203d58]";

interface DocumentDropInputProps {
  disabled?: boolean;
  name?: string;
  id?: string;
  label?: string;
  hint?: string;
  onFileChange?: (file: File | null) => void;
}

function isAcceptedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".docx")
  );
}

export function DocumentDropInput({
  disabled,
  name = "document",
  id: idProp,
  label = "Documento (PDF o DOCX)",
  hint = "Arrastra el archivo aquí o haz clic para elegirlo.",
  onFileChange,
}: DocumentDropInputProps) {
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

  const setSelectedFile = useCallback(
    (next: File | null) => {
      setFile(next);
      onFileChange?.(next);
      if (fileInputRef.current) {
        const dt = new DataTransfer();
        if (next) dt.items.add(next);
        fileInputRef.current.files = dt.files;
      }
    },
    [onFileChange]
  );

  function pickFile(incoming: File | null) {
    if (!incoming) {
      setError("");
      setSelectedFile(null);
      return;
    }
    if (!isAcceptedFile(incoming)) {
      setError("Solo se aceptan archivos PDF o DOCX.");
      return;
    }
    setError("");
    setSelectedFile(incoming);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
  }

  return (
    <div>
      <label htmlFor={inputId} className={labelClasses}>
        {label}
        <RequiredMark />
      </label>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={
          "rounded-2xl border-2 border-dashed px-4 py-10 text-center outline-none transition duration-200 " +
          (dragOver
            ? "scale-[1.01] border-[#1a6999] bg-[#e8f3f8]"
            : "border-[#a8c7d9] bg-[#f6fafc]") +
          " focus:border-[#1a6999] focus:ring-4 focus:ring-[#1a6999]/10 " +
          (disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[#1a6999] hover:bg-[#eef6fa]")
        }
      >
        <p className="text-sm font-medium text-[#37352f]">
          {file ? file.name : "Suelta el PDF o DOCX aquí"}
        </p>
        <p className="mt-1 text-xs text-[#9b9a97]">
          {file ? "Haz clic para cambiar el archivo" : hint}
        </p>
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        name={name}
        type="file"
        accept={ACCEPT}
        required
        disabled={disabled}
        className="sr-only"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      {error && <p className="mt-1.5 text-xs text-[#b5403a]">{error}</p>}
    </div>
  );
}
