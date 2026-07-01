"use client";

import { useCallback, useId, useRef, useState } from "react";

const MAX_IMAGES = 10;

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

interface EvidenceInputProps {
  disabled?: boolean;
  onChange?: (files: File[]) => void;
}

export function EvidenceInput({ disabled, onChange }: EvidenceInputProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  const updateFiles = useCallback(
    (updater: File[] | ((prev: File[]) => File[])) => {
      setFiles((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  const addFiles = useCallback(
    (incoming: File[]) => {
      const images = incoming.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;

      updateFiles((prev) => {
        const merged = [...prev];
        for (const file of images) {
          if (merged.length >= MAX_IMAGES) break;
          const name =
            file.name && file.name !== "image.png"
              ? file.name
              : `captura-${merged.length + 1}.png`;
          merged.push(new File([file], name, { type: file.type || "image/png" }));
        }
        return merged.slice(0, MAX_IMAGES);
      });
    },
    [updateFiles]
  );

  function removeFile(index: number) {
    updateFiles(files.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    const pasted: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) pasted.push(file);
      }
    }
    if (pasted.length > 0) {
      e.preventDefault();
      addFiles(pasted);
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className={labelClasses}>
        Imágenes <span className="font-normal text-[#9b9a97]">(Recomendado, máx. {MAX_IMAGES})</span>
      </label>

      <div
        tabIndex={disabled ? -1 : 0}
        onPaste={handlePaste}
        className={
          "rounded-md border border-dashed border-[#d3d1cb] bg-[#f7f7f5] px-3 py-4 text-center outline-none transition " +
          "focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20 " +
          (disabled ? "cursor-not-allowed opacity-60" : "cursor-text")
        }
      >
        <p className="text-sm text-[#37352f]">Haz clic aquí y pega una captura</p>
        <p className="mt-1 text-xs text-[#9b9a97]">Ctrl+V · también puedes elegir archivos abajo</p>
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        className="mt-2 block w-full text-sm text-[#787774] file:mr-3 file:rounded-md file:border file:border-[#efefef] file:bg-[#f7f7f5] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#37352f] hover:file:bg-[#efefef] disabled:opacity-60"
      />

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md border border-[#efefef] bg-white px-2 py-1.5 text-xs text-[#787774]"
            >
              <span className="truncate">• {file.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeFile(index)}
                className="shrink-0 text-[#b5403a] hover:underline disabled:opacity-60"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
