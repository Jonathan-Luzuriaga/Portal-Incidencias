"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PropuestaListResponse } from "@/app/api/propuestas/lista/route";
import type { PropuestaListItem } from "@/lib/notion-propuesta-list";

type Status = "idle" | "loading_preview" | "loading_pdf" | "preview_ready" | "error";

const REQUEST_TIMEOUT_MS = 130_000;

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

function buildPreviewUrl(pageId: string): string {
  return `/api/propuestas/pdf/preview?pageId=${encodeURIComponent(pageId)}`;
}

function buildDownloadUrl(pageId: string): string {
  return `/api/propuestas/pdf/download?pageId=${encodeURIComponent(pageId)}`;
}

function toAbsoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).href;
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

function openInNewTab(path: string): void {
  const href = toAbsoluteUrl(path);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timeoutId);
    return res;
  } catch (err) {
    window.clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("La generación tardó demasiado. Intenta de nuevo.");
    }
    throw err;
  }
}

async function parseErrorResponse(res: Response): Promise<string> {
  let message = `Error ${res.status}`;
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) message = data.error;
  } catch {
    // respuesta no JSON
  }
  return message;
}

export default function ProposalWorkflowPdfGenerator() {
  const [propuestas, setPropuestas] = useState<PropuestaListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [embedded, setEmbedded] = useState(false);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const resizePreviewFrame = useCallback(() => {
    const frame = previewFrameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc?.body) return;
    const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 1122);
    frame.style.height = `${height + 24}px`;
  }, []);

  const busy = status === "loading_preview" || status === "loading_pdf";
  const previewReady = status === "preview_ready" && Boolean(previewHtml);

  const loadPreview = useCallback(async (pageId: string) => {
    if (!pageId) return;
    setErrorMsg("");
    setStatus("loading_preview");
    setPreviewHtml("");

    try {
      const res = await fetchWithTimeout(buildPreviewUrl(pageId));
      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      const contentType = res.headers.get("Content-Type") ?? "";
      if (!contentType.includes("text/html")) {
        throw new Error("La vista previa no devolvió HTML válido.");
      }

      const html = await res.text();
      if (!html.trim()) {
        throw new Error("La vista previa llegó vacía.");
      }

      setPreviewHtml(html);
      setStatus("preview_ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo generar la vista previa.");
      setStatus("error");
    }
  }, []);

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
          if (data.propuestas.length > 0) {
            setSelected(data.propuestas[0].id);
          }
        } else {
          setListError(!data.ok ? data.error : `Error ${res.status}`);
        }
      } catch {
        if (active) setListError("No se pudieron cargar las propuestas de Notion.");
      } finally {
        if (active) setLoadingList(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected || loadingList) return;
    void loadPreview(selected);
  }, [selected, loadingList, loadPreview]);

  async function handleDownload() {
    if (!selected || busy) return;
    setErrorMsg("");

    const url = buildDownloadUrl(selected);

    if (isEmbeddedInFrame()) {
      openInNewTab(url);
      return;
    }

    setStatus("loading_pdf");
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      const contentType = res.headers.get("Content-Type") ?? "";
      if (!contentType.includes("application/pdf")) {
        throw new Error("La respuesta no fue un PDF.");
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error("El PDF llegó vacío.");
      }

      const filename = parseFilenameFromDisposition(res.headers.get("Content-Disposition") ?? "");
      triggerBlobDownload(blob, filename);
      setStatus(previewHtml ? "preview_ready" : "idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo descargar el PDF.");
      setStatus("error");
    }
  }

  function handleRefreshPreview() {
    if (!selected || busy) return;
    void loadPreview(selected);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#efefef] bg-white p-5">
        <div>
          <label htmlFor="workflow-propuesta-select" className={labelClasses}>
            Propuesta en Notion
          </label>
          {loadingList ? (
            <p className="text-sm text-[#9b9a97]">Cargando propuestas…</p>
          ) : listError ? (
            <p className="text-sm text-[#b5403a]">{listError}</p>
          ) : propuestas.length === 0 ? (
            <p className="text-sm text-[#9b9a97]">
              No hay propuestas con categoría &quot;Propuesta&quot; en Notion.
            </p>
          ) : (
            <select
              id="workflow-propuesta-select"
              value={selected}
              disabled={busy}
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
          Transcribe el contenido de Notion sobre la plantilla corporativa. La vista previa usa el mismo
          paginado que el PDF descargado.
        </p>
        </div>

        {status === "loading_preview" && (
          <p className="mt-3 text-sm text-[#787774]">
            Leyendo Notion, aplicando plantilla y paginando (puede tardar hasta 1 minuto)…
          </p>
        )}

        {status === "loading_pdf" && (
          <p className="mt-3 text-sm text-[#787774]">
            Generando PDF… puede tardar hasta 1 minuto la primera vez.
          </p>
        )}

        {status === "error" && errorMsg && (
          <div className="mt-3 rounded-md border border-[#ffe2dd] bg-[#fdf0ef] px-3 py-2 text-sm text-[#b5403a] whitespace-pre-wrap">
            {errorMsg}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleRefreshPreview}
            disabled={busy || !selected || propuestas.length === 0}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[#efefef] bg-white px-4 py-2.5 text-sm font-medium text-[#37352f] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "loading_preview" && <Spinner />}
            Actualizar vista previa
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy || !selected || propuestas.length === 0}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#2383e2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a73d1] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "loading_pdf" && <Spinner />}
            {status === "loading_pdf" ? "Generando PDF…" : "Descargar PDF"}
          </button>
        </div>

        {embedded && selected ? (
          <p className="mt-2 text-center text-xs text-[#9b9a97]">
            Dentro de Notion la descarga se abre en otra pestaña del navegador.
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-[#efefef] bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-[#37352f]">Vista previa</h2>
          {previewReady ? (
            <span className="text-xs text-[#9b9a97]">Misma salida que el PDF</span>
          ) : null}
        </div>

        {!selected || propuestas.length === 0 ? (
          <p className="text-sm text-[#9b9a97]">Selecciona una propuesta para ver la vista previa.</p>
        ) : status === "loading_preview" ? (
          <div className="flex h-[480px] items-center justify-center rounded-md border border-dashed border-[#e3e2e0] bg-[#fafafa] text-sm text-[#787774]">
            <span className="inline-flex items-center gap-2">
              <Spinner />
              Generando vista previa…
            </span>
          </div>
        ) : previewReady ? (
          <div className="overflow-auto rounded-md border border-[#e3e2e0] bg-[#252525] p-2">
            <iframe
              ref={previewFrameRef}
              title="Vista previa de la propuesta"
              srcDoc={previewHtml}
              onLoad={resizePreviewFrame}
              className="mx-auto block border-0 bg-white"
              style={{ width: "794px", minHeight: "1122px" }}
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-[#e3e2e0] bg-[#fafafa] text-sm text-[#9b9a97]">
            {status === "error" ? "No se pudo cargar la vista previa." : "Sin vista previa."}
          </div>
        )}
      </div>
    </div>
  );
}
