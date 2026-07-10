"use client";

import { useEffect, useState } from "react";
import type { PropuestaListResponse } from "@/app/api/propuestas/lista/route";
import type { PropuestaListItem } from "@/lib/notion-propuesta-list";
import {
  isEmbeddedInFrame,
  openPdfOutsideSandbox,
  toAbsoluteUrl,
} from "@/lib/embed-download";
import { PROPUESTA_STANDARD_GUIDE } from "@/lib/propuesta-pdf/propuesta-standardize";

type Status = "idle" | "loading" | "error" | "opened_top";

const DOWNLOAD_TIMEOUT_MS = 130_000;

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

const fieldClasses =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] " +
  "shadow-[0_1px_2px_rgba(15,15,15,0.04)] outline-none transition " +
  "focus:border-[#b9b9b7] focus:ring-2 focus:ring-[#2383e2]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const primaryBtnClasses =
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

function parseFilenameFromDisposition(header: string): string {
  const utf8Match = header.match(/filename\*=UTF-8''([^;\s]+)/i)?.[1];
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match);
    } catch {
      // continuar
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

function StandardGuidePanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-[#efefef] bg-[#fafafa]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-[#37352f]"
      >
        <span>{PROPUESTA_STANDARD_GUIDE.title}</span>
        <span className="text-xs text-[#9b9a97]">{open ? "Ocultar" : "Mostrar"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#efefef] px-3 py-3 text-sm text-[#787774]">
          <p>{PROPUESTA_STANDARD_GUIDE.intro}</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs">
            {PROPUESTA_STANDARD_GUIDE.sections.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <ol className="list-inside list-decimal space-y-1 text-xs">
            {PROPUESTA_STANDARD_GUIDE.notionSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
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
  const pdfAbsoluteUrl = selected ? toAbsoluteUrl(buildPdfUrl(selected)) : "";
  const canDownload = Boolean(selected) && propuestas.length > 0 && !loadingList;

  useEffect(() => {
    setEmbedded(isEmbeddedInFrame());
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

  function handleDownload() {
    if (!selected || generating || !canDownload) return;
    setErrorMsg("");

    // Dentro de Notion: salir del sandbox navegando la ventana superior a la URL real del PDF.
    if (embedded) {
      openPdfOutsideSandbox(buildPdfUrl(selected));
      setStatus("opened_top");
      return;
    }

    setStatus("loading");
    void (async () => {
      try {
        await downloadViaFetch(buildPdfUrl(selected));
        setStatus("idle");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "No se pudo generar el PDF. Intenta de nuevo.");
        setStatus("error");
      }
    })();
  }

  return (
    <div className="space-y-4 rounded-lg border border-[#efefef] bg-white p-5">
      <StandardGuidePanel />

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
            onChange={(e) => {
              setSelected(e.target.value);
              setStatus("idle");
              setErrorMsg("");
            }}
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
          El PDF se genera con la plantilla corporativa fija: tablas estándar, 9 actividades, precios
          calculados automáticamente.
        </p>
      </div>

      {generating && (
        <p className="text-sm text-[#787774]">
          Normalizando contenido y generando PDF… puede tardar hasta 1 minuto la primera vez.
        </p>
      )}

      {embedded && canDownload ? (
        <div className="rounded-md border border-[#d3e5fd] bg-[#edf3fe] px-3 py-2 text-sm text-[#37352f]">
          Estás dentro de Notion. Al descargar se abrirá el PDF fuera del embed (puede tardar hasta 1
          minuto). Luego puedes volver a esta página en Notion.
        </div>
      ) : null}

      {status === "opened_top" && embedded ? (
        <div className="rounded-md border border-[#d3e5fd] bg-[#edf3fe] px-3 py-2 text-sm text-[#37352f]">
          Abriendo el PDF fuera del embed… Si no ocurre nada, usa el enlace de abajo.
        </div>
      ) : null}

      {status === "error" && (
        <div className="rounded-md border border-[#ffe2dd] bg-[#fdf0ef] px-3 py-2 text-sm text-[#b5403a] whitespace-pre-wrap">
          {errorMsg}
        </div>
      )}

      <button
        type="button"
        onClick={handleDownload}
        disabled={generating || !canDownload}
        className={primaryBtnClasses}
      >
        {generating && <Spinner />}
        {generating ? "Generando PDF…" : "Descargar PDF"}
      </button>

      {embedded && canDownload && pdfAbsoluteUrl ? (
        <p className="text-center text-xs text-[#787774]">
          Si no descarga,{" "}
          <a
            href={pdfAbsoluteUrl}
            target="_top"
            rel="noopener noreferrer"
            className="font-medium text-[#2383e2] underline"
          >
            ábrelo aquí
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
