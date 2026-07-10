"use client";

import { useEffect, useState } from "react";
import type { PropuestaListResponse } from "@/app/api/propuestas/lista/route";
import { RequiredMark } from "@/components/RequiredMark";
import type { PropuestaListItem } from "@/lib/notion-propuesta-list";
import {
  copyTextToClipboard,
  isEmbeddedInFrame,
  openPdfInNewTab,
  toAbsoluteUrl,
} from "@/lib/embed-download";
import { PROPUESTA_STANDARD_GUIDE } from "@/lib/propuesta-pdf/propuesta-standardize";

type Status = "idle" | "error";

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

const fieldClasses =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] " +
  "shadow-[0_1px_2px_rgba(15,15,15,0.04)] outline-none transition " +
  "focus:border-[#b9b9b7] focus:ring-2 focus:ring-[#2383e2]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const primaryBtnClasses =
  "inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2383e2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a73d1] disabled:cursor-not-allowed disabled:opacity-70";

function buildPdfUrl(pageId: string): string {
  return `/api/propuestas/pdf?pageId=${encodeURIComponent(pageId)}`;
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
  const [copied, setCopied] = useState(false);

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
    if (!selected || !canDownload) return;
    setErrorMsg("");
    setCopied(false);

    const opened = openPdfInNewTab(buildPdfUrl(selected));
    if (opened) {
      setStatus("idle");
      return;
    }

    setErrorMsg(
      "El navegador bloqueó la pestaña nueva. Usa “Copiar enlace” o permite ventanas emergentes."
    );
    setStatus("error");
  }

  async function handleCopyLink() {
    if (!pdfAbsoluteUrl) return;
    const ok = await copyTextToClipboard(pdfAbsoluteUrl);
    setCopied(ok);
    if (!ok) {
      setErrorMsg("No se pudo copiar. Selecciona y copia el enlace manualmente.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-[#efefef] bg-white p-5">
      <StandardGuidePanel />

      <div>
        <label htmlFor="propuesta-select" className={labelClasses}>
          Propuesta
          <RequiredMark />
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
            onChange={(e) => {
              setSelected(e.target.value);
              setStatus("idle");
              setErrorMsg("");
              setCopied(false);
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

      {embedded && canDownload ? (
        <div className="space-y-2 rounded-md border border-[#d3e5fd] bg-[#edf3fe] px-3 py-2 text-sm text-[#37352f]">
          <p>
            El PDF se abre en una <strong>pestaña nueva</strong>. Si el navegador la bloquea, copia el
            enlace y ábrelo manualmente.
          </p>
          <p className="break-all rounded border border-[#efefef] bg-white px-2 py-1.5 font-mono text-xs text-[#787774]">
            {pdfAbsoluteUrl}
          </p>
          <button
            type="button"
            onClick={handleCopyLink}
            className="rounded-md border border-[#e3e2e0] bg-white px-3 py-1.5 text-xs font-medium text-[#37352f] transition hover:bg-[#f7f7f5]"
          >
            {copied ? "Enlace copiado" : "Copiar enlace del PDF"}
          </button>
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
        disabled={!canDownload}
        className={primaryBtnClasses}
      >
        Descargar PDF
      </button>
    </div>
  );
}
