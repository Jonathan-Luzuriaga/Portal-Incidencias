"use client";

import { useCallback, useId, useRef, useState } from "react";

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

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
          "rounded-md border border-dashed px-4 py-8 text-center outline-none transition " +
          (dragOver
            ? "border-[#2383e2] bg-[#e8f3fc]"
            : "border-[#d3d1cb] bg-[#f7f7f5]") +
          " focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20 " +
          (disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[#b9b9b7]")
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
