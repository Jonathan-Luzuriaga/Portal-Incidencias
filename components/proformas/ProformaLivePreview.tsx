"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generarHtmlProforma } from "@/lib/proforma-pdf-template";
import type { ProformaPreviewDatos } from "@/lib/proforma-types";
import {
  formatCodigoEstimacion,
  formatCodigoProyecto,
} from "@/lib/proforma-codigos";

const LOGO_PUBLIC = "/propuestas-assets/manticore-logo-full.png";
const PAGE_WIDTH = 794;
const PAGE_MIN_HEIGHT = 1122;

const PREVIEW_IFRAME_CSS = `
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden !important;
  background: #ffffff;
}
.document {
  margin: 0;
  padding: 0;
}
`;

interface PageMetrics {
  offsetTop: number;
  height: number;
}

interface ProformaLivePreviewProps {
  datos: ProformaPreviewDatos;
}

function ChevronLeft() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function injectPreviewCss(html: string): string {
  return html.replace("</head>", `<style>${PREVIEW_IFRAME_CSS}</style></head>`);
}

export function ProformaLivePreview({ datos }: ProformaLivePreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const [currentPage, setCurrentPage] = useState(0);
  const [pageMetrics, setPageMetrics] = useState<PageMetrics[]>([{ offsetTop: 0, height: PAGE_MIN_HEIGHT }]);
  const [docHeight, setDocHeight] = useState(PAGE_MIN_HEIGHT);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const previewHtml = useMemo(() => {
    const codigoProyecto = formatCodigoProyecto(datos.codigoProyecto);
    const codigoEstimacion = formatCodigoEstimacion(datos.codigoEstimacion);
    if (!codigoProyecto || !codigoEstimacion || !datos.descripcion.trim() || datos.horas <= 0) {
      return "";
    }

    const html = generarHtmlProforma({
      codigoProyecto,
      codigoEstimacion,
      descripcion: datos.descripcion.trim(),
      horas: datos.horas,
      perfil: datos.perfil,
      actividades: datos.actividades.filter((a) => a.actividad.trim() || a.descripcion.trim()),
      logoSrc: LOGO_PUBLIC,
    });

    return injectPreviewCss(html);
  }, [datos]);

  const measurePages = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;

    const pages = Array.from(doc.querySelectorAll<HTMLElement>("[data-proforma-page]"));
    if (pages.length === 0) {
      setPageMetrics([{ offsetTop: 0, height: PAGE_MIN_HEIGHT }]);
      return;
    }

    const metrics = pages.map((page) => ({
      offsetTop: page.offsetTop,
      height: Math.max(page.offsetHeight, PAGE_MIN_HEIGHT),
    }));

    setPageMetrics(metrics);
    setDocHeight(doc.documentElement.scrollHeight);
    setCurrentPage((prev) => Math.min(prev, Math.max(metrics.length - 1, 0)));
  }, []);

  const handleFrameLoad = useCallback(() => {
    measurePages();
    window.setTimeout(measurePages, 120);
    window.setTimeout(measurePages, 400);
  }, [measurePages]);

  useEffect(() => {
    setCurrentPage(0);
  }, [previewHtml]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const updateSize = () => {
      setViewportSize({ width: node.clientWidth, height: node.clientHeight });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [previewHtml]);

  useEffect(() => {
    measurePages();
  }, [previewHtml, measurePages]);

  const pageCount = pageMetrics.length;
  const activePage = pageMetrics[currentPage] ?? pageMetrics[0];
  const pageHeight = activePage?.height ?? PAGE_MIN_HEIGHT;
  const pageOffset = activePage?.offsetTop ?? 0;

  const scale = useMemo(() => {
    const width = viewportSize.width || 360;
    const height = viewportSize.height || 520;
    return Math.min(width / PAGE_WIDTH, height / pageHeight, 1);
  }, [viewportSize, pageHeight]);

  const displayWidth = PAGE_WIDTH * scale;
  const displayHeight = pageHeight * scale;

  function goPrev() {
    setCurrentPage((p) => Math.max(0, p - 1));
  }

  function goNext() {
    setCurrentPage((p) => Math.min(pageCount - 1, p + 1));
  }

  if (!previewHtml) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[#e3e2e0] bg-[#fafafa] p-6 text-center text-sm text-[#9b9a97]">
        Completa los campos obligatorios para ver la previsualización del PDF.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentPage <= 0}
          aria-label="Página anterior"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e3e2e0] bg-white text-[#37352f] transition hover:bg-[#f7f7f5] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft />
        </button>

        <p className="text-xs font-medium text-[#787774]">
          Página {currentPage + 1} de {pageCount}
        </p>

        <button
          type="button"
          onClick={goNext}
          disabled={currentPage >= pageCount - 1}
          aria-label="Página siguiente"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e3e2e0] bg-white text-[#37352f] transition hover:bg-[#f7f7f5] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight />
        </button>
      </div>

      <div
        ref={viewportRef}
        className="flex w-full min-h-[min(68vh,780px)] items-center justify-center overflow-hidden rounded-lg border border-[#d8d8d8] bg-[#ececec] p-5 sm:p-6"
      >
        <div
          className="relative shrink-0 overflow-hidden rounded-sm bg-white shadow-[0_10px_28px_rgba(15,15,15,0.18)] ring-1 ring-[#d0d0d0]"
          style={{ width: displayWidth, height: displayHeight }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: PAGE_WIDTH,
              height: pageHeight,
              transform: `scale(${scale})`,
            }}
          >
            <div style={{ transform: `translateY(-${pageOffset}px)` }}>
              <iframe
                ref={frameRef}
                title="Vista previa de la proforma"
                srcDoc={previewHtml}
                onLoad={handleFrameLoad}
                width={PAGE_WIDTH}
                height={docHeight}
                className="block border-0 bg-white"
                scrolling="no"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
