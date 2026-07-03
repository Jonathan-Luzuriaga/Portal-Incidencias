"use client";

import { useEffect, useState } from "react";
import type { PropuestaListResponse } from "@/app/api/propuestas/lista/route";
import type { PropuestaListItem } from "@/lib/notion-propuesta-list";

type Status = "idle" | "loading" | "error";

const DOWNLOAD_TIMEOUT_MS = 90_000;

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

function isEmbeddedInFrame(): boolean {
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

/**
 * En iframes (Notion embed) el sandbox bloquea descargas vía blob.
 * Un iframe oculto apuntando a la API usa Content-Disposition del servidor
 * y suele funcionar sin abrir pestañas ni salir de la página.
 */
function downloadViaHiddenFrame(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
    iframe.setAttribute("aria-hidden", "true");

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("La generación tardó demasiado. Intenta de nuevo."));
    }, DOWNLOAD_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timeoutId);
      window.setTimeout(() => iframe.remove(), 3000);
    }

    iframe.onload = () => {
      try {
        const text = iframe.contentDocument?.body?.innerText?.trim() ?? "";
        if (text.startsWith("{")) {
          const data = JSON.parse(text) as { ok?: boolean; error?: string };
          if (data.ok === false && data.error) {
            cleanup();
            reject(new Error(data.error));
            return;
          }
        }
      } catch {
        // Respuesta PDF u otro binario: la descarga la gestiona el navegador.
      }
      cleanup();
      resolve();
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("No se pudo generar el PDF. Intenta de nuevo."));
    };

    iframe.src = url;
    document.body.appendChild(iframe);
  });
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

  const generating = status === "loading";

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
    setStatus("loading");
    setErrorMsg("");

    const url = buildPdfUrl(selected);

    try {
      if (isEmbeddedInFrame()) {
        await downloadViaHiddenFrame(url);
      } else {
        await downloadViaFetch(url);
      }
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
          Selecciona una propuesta y descárgala con el formato corporativo. La primera descarga puede tardar hasta
          60 segundos.
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

      <button
        type="button"
        onClick={handleDownload}
        disabled={generating || !selected || propuestas.length === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2383e2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a73d1] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {generating && <Spinner />}
        {generating ? "Generando PDF…" : "Descargar PDF"}
      </button>
    </div>
  );
}
