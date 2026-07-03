"use client";

import { useEffect, useState } from "react";
import type { PropuestaListResponse } from "@/app/api/propuestas/lista/route";
import type { PropuestaListItem } from "@/lib/notion-propuesta-list";

type Status = "idle" | "loading" | "error" | "ready";

const DOWNLOAD_TIMEOUT_MS = 90_000;

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

const fieldClasses =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] " +
  "shadow-[0_1px_2px_rgba(15,15,15,0.04)] outline-none transition " +
  "focus:border-[#b9b9b7] focus:ring-2 focus:ring-[#2383e2]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const buttonClasses =
  "inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2383e2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a73d1] disabled:cursor-not-allowed disabled:opacity-70";

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function buildPdfUrl(pageId: string): string {
  return `/api/propuestas/pdf?pageId=${encodeURIComponent(pageId)}`;
}

function isEmbeddedInFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function parseFilenameFromDisposition(header: string): string {
  const utf8Match = header.match(/filename\*=UTF-8''([^;\s]+)/i)?.[1];
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match);
    } catch {
      // continuar con filename ASCII
    }
  }
  return header.match(/filename="([^"]+)"/)?.[1] ?? "Propuesta.pdf";
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export default function ProposalPdfGenerator() {
  const [propuestas, setPropuestas] = useState<PropuestaListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [embedded, setEmbedded] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; filename: string } | null>(null);

  const generating = status === "loading";

  useEffect(() => {
    setEmbedded(isEmbeddedInFrame());
  }, []);

  useEffect(() => {
    return () => {
      if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    };
  }, [pdfPreview]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/propuestas/lista");
        const data = (await res.json()) as PropuestaListResponse;
        if (!active) return;
        if (res.ok && data.ok) {
          setPropuestas(data.propuestas);
          if (data.propuestas.length > 0) setSelected(data.propuestas[0].id);
        } else {
          setListError(!data.ok ? data.error : `Error ${res.status}`);
        }
      } catch {
        if (active) setListError("No se pudieron cargar las propuestas.");
      } finally {
        if (active) setLoadingList(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function clearPreview() {
    setPdfPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  function handleSelectionChange(pageId: string) {
    setSelected(pageId);
    clearPreview();
    setStatus("idle");
    setErrorMsg("");
  }

  async function handleDownload() {
    if (!selected || generating) return;
    setStatus("loading");
    setErrorMsg("");
    clearPreview();

    const url = buildPdfUrl(selected);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });
      window.clearTimeout(timeoutId);

      if (!res.ok) {
        let message = `Error ${res.status}`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // respuesta no JSON
        }
        setErrorMsg(message);
        setStatus("error");
        return;
      }

      const contentType = res.headers.get("Content-Type") ?? "";
      if (!contentType.includes("application/pdf")) {
        setErrorMsg("La respuesta no fue un PDF. Intenta de nuevo.");
        setStatus("error");
        return;
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        setErrorMsg("El PDF llegó vacío. Intenta de nuevo.");
        setStatus("error");
        return;
      }

      const filename = parseFilenameFromDisposition(res.headers.get("Content-Disposition") ?? "");

      if (embedded) {
        // En iframe de Notion no se puede forzar descarga automática; se muestra aquí.
        const previewUrl = URL.createObjectURL(blob);
        setPdfPreview({ url: previewUrl, filename });
        setStatus("ready");
        return;
      }

      triggerBlobDownload(blob, filename);
      setStatus("idle");
    } catch (err) {
      window.clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMsg("La generación tardó demasiado. Intenta de nuevo.");
      } else {
        setErrorMsg("No se pudo generar el PDF. Intenta de nuevo.");
      }
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-[#efefef] bg-white p-5">
      <div>
        <label htmlFor="propuesta-select" className={labelClasses}>
          Propuesta
        </label>
        {loadingList ? (
          <p className="text-sm text-[#9b9a97]">Cargando propuestas…</p>
        ) : listError ? (
          <p className="text-sm text-[#b5403a]">{listError}</p>
        ) : propuestas.length === 0 ? (
          <p className="text-sm text-[#9b9a97]">
            No hay propuestas en Notion todavía. Súbelas desde la pestaña “Subir propuesta”.
          </p>
        ) : (
          <select
            id="propuesta-select"
            value={selected}
            disabled={generating}
            onChange={(e) => handleSelectionChange(e.target.value)}
            className={fieldClasses}
          >
            {propuestas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `${p.code} — ` : ""}
                {p.title.replace(/^propuesta\s*[—-]\s*/i, "")}
              </option>
            ))}
          </select>
        )}
        <p className="mt-1.5 text-xs text-[#9b9a97]">
          {embedded
            ? "Genera el PDF aquí y guárdalo con el botón de abajo. La primera vez puede tardar hasta 60 segundos."
            : "Selecciona una propuesta y descárgala con el formato corporativo. La primera descarga puede tardar hasta 60 segundos."}
        </p>
      </div>

      {generating && (
        <p className="text-sm text-[#787774]">
          Generando el PDF… puede tardar hasta 60 segundos la primera vez.
        </p>
      )}

      {status === "error" && (
        <div className="rounded-md border border-[#ffe2dd] bg-[#fdf0ef] px-3 py-2 text-sm text-[#b5403a]">
          {errorMsg}
        </div>
      )}

      {pdfPreview && (
        <div className="space-y-3">
          <embed
            src={pdfPreview.url}
            type="application/pdf"
            className="h-[min(480px,60vh)] w-full rounded-md border border-[#efefef]"
            title="Vista previa del PDF"
          />
          <a href={pdfPreview.url} download={pdfPreview.filename} className={buttonClasses}>
            Guardar PDF
          </a>
          <p className="text-xs text-[#9b9a97]">
            Si el botón no descarga, usa el icono de descarga del visor del PDF.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleDownload}
        disabled={generating || !selected || propuestas.length === 0}
        className={buttonClasses}
      >
        {generating && <Spinner />}
        {generating ? "Generando PDF…" : pdfPreview ? "Regenerar PDF" : "Descargar PDF"}
      </button>
    </div>
  );
}
