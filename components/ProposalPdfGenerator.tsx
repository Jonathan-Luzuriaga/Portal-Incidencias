"use client";

import { useEffect, useState } from "react";
import type { PropuestaListResponse } from "@/app/api/propuestas/lista/route";
import type { PropuestaListItem } from "@/lib/notion-propuesta-list";

type Status = "idle" | "loading" | "error" | "opened_tab";

/** Debe superar maxDuration del API (120 s) con margen. */
const DOWNLOAD_TIMEOUT_MS = 130_000;

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

const fieldClasses =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] " +
  "shadow-[0_1px_2px_rgba(15,15,15,0.04)] outline-none transition " +
  "focus:border-[#b9b9b7] focus:ring-2 focus:ring-[#2383e2]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

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

function toAbsoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).href;
}

/** Detecta embed de Notion u otro iframe donde fetch+blob suele fallar o colgar. */
function detectEmbedded(): boolean {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const ref = document.referrer.toLowerCase();
  return ref.includes("notion.so") || ref.includes("notion.site");
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

/**
 * Abre la URL del API en pestaña nueva con clic sintético en <a>.
 * Más fiable que fetch+blob o iframe oculto dentro del sandbox de Notion.
 */
function openPdfInNewTab(path: string): void {
  const href = toAbsoluteUrl(path);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function downloadViaFetch(url: string): Promise<void> {
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
      throw new Error(message);
    }

    const contentType = res.headers.get("Content-Type") ?? "";
    if (!contentType.includes("application/pdf")) {
      throw new Error("La respuesta no fue un PDF. Intenta de nuevo.");
    }

    const blob = await res.blob();
    if (blob.size === 0) {
      throw new Error("El PDF llegó vacío. Intenta de nuevo.");
    }

    const filename = parseFilenameFromDisposition(res.headers.get("Content-Disposition") ?? "");
    triggerBlobDownload(blob, filename);
  } catch (err) {
    window.clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("La generación tardó demasiado. Intenta de nuevo.");
    }
    throw err;
  }
}

export default function ProposalPdfGenerator() {
  const [propuestas, setPropuestas] = useState<PropuestaListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [embedded, setEmbedded] = useState(false);

  const generating = status === "loading";
  const pdfPath = selected ? buildPdfUrl(selected) : "";
  const pdfAbsoluteUrl = pdfPath ? toAbsoluteUrl(pdfPath) : "";

  useEffect(() => {
    setEmbedded(detectEmbedded());
  }, []);

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

  async function handleDownload() {
    if (!selected || generating) return;
    setErrorMsg("");

    const url = buildPdfUrl(selected);

    // En Notion embed: no usar fetch (puede colgar 90–130 s). El API responde con Content-Disposition.
    if (embedded) {
      openPdfInNewTab(url);
      setStatus("opened_tab");
      return;
    }

    setStatus("loading");
    try {
      await downloadViaFetch(url);
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo generar el PDF. Intenta de nuevo.");
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
            onChange={(e) => setSelected(e.target.value)}
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
            ? "En Notion se abre una pestaña nueva para generar y descargar el PDF (hasta 2 min la primera vez)."
            : "Selecciona una propuesta y descárgala con el formato corporativo. La primera descarga puede tardar hasta 2 minutos."}
        </p>
      </div>

      {generating && (
        <p className="text-sm text-[#787774]">
          Generando el PDF… puede tardar hasta 2 minutos la primera vez (Notion + IA + maquetación).
        </p>
      )}

      {status === "opened_tab" && (
        <div className="rounded-md border border-[#d3e5fd] bg-[#edf3fe] px-3 py-2 text-sm text-[#37352f]">
          Se abrió una pestaña nueva. Espera ahí hasta que termine la descarga (puede tardar 1–2 minutos).
          {pdfAbsoluteUrl ? (
            <>
              {" "}
              Si no se abrió,{" "}
              <a
                href={pdfAbsoluteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#2383e2] underline"
              >
                haz clic aquí para generar el PDF
              </a>
              .
            </>
          ) : null}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-md border border-[#ffe2dd] bg-[#fdf0ef] px-3 py-2 text-sm text-[#b5403a]">
          {errorMsg}
          {pdfAbsoluteUrl ? (
            <>
              {" "}
              <a
                href={pdfAbsoluteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Probar enlace directo
              </a>
            </>
          ) : null}
        </div>
      )}

      <button
        type="button"
        onClick={handleDownload}
        disabled={generating || !selected || propuestas.length === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2383e2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a73d1] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {generating && <Spinner />}
        {generating ? "Generando PDF…" : embedded ? "Generar PDF (pestaña nueva)" : "Descargar PDF"}
      </button>

      {embedded && selected && pdfAbsoluteUrl ? (
        <p className="text-center text-xs text-[#9b9a97]">
          <a href={pdfAbsoluteUrl} target="_blank" rel="noopener noreferrer" className="text-[#2383e2] underline">
            Enlace directo al PDF
          </a>{" "}
          si el botón no funciona
        </p>
      ) : null}
    </div>
  );
}
