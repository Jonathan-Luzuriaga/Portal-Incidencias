/**
 * Orquestación del flujo workflow: Notion → plantilla corporativa fija + contenido literal → HTML/PDF.
 * El texto de Notion se transcribe tal cual (sin tablas fijas ni recálculos que omitan secciones).
 */
import { getPropuestaContent } from "@/lib/notion-propuesta-list";
import type { PropuestaCoverData } from "@/lib/propuesta-pdf/html";
import { loadCorporateAssets } from "@/lib/propuesta-pdf/assets";
import { buildLiteralCorporateHtml } from "@/lib/propuesta-pdf/literal-template";
import { renderHtmlToPdf, renderHtmlToPreviewDocument, warmChromiumExecutable } from "@/lib/propuesta-pdf/render";
import type { CorporateCover } from "@/lib/propuesta-pdf/corporate-types";

export interface WorkflowProposalHtml {
  title: string;
  html: string;
}

function toCorporateCover(cover: PropuestaCoverData): CorporateCover {
  return {
    name: cover.name,
    code: cover.code,
    version: cover.version,
    fecha: cover.fecha,
    validezDias: Number(String(cover.validezDias).replace(/[^0-9]/g, "")) || 45,
  };
}

function buildRawWorkflowHtml(
  cover: PropuestaCoverData,
  blocks: Awaited<ReturnType<typeof getPropuestaContent>>["blocks"]
): string {
  const assets = loadCorporateAssets();
  return buildLiteralCorporateHtml(toCorporateCover(cover), blocks, assets);
}

/** Lee la tarea de Notion y genera el HTML corporativo sin paginar (solo uso interno). */
export async function buildWorkflowProposalHtml(pageId: string): Promise<WorkflowProposalHtml> {
  const { title, cover, blocks } = await getPropuestaContent(pageId);
  const html = buildRawWorkflowHtml(cover, blocks);
  return { title, html };
}

/**
 * Vista previa: mismo HTML que el PDF, con paginación A4 aplicada en Chromium
 * para que coincida con el documento descargado.
 */
export async function buildWorkflowProposalPreviewHtml(pageId: string): Promise<WorkflowProposalHtml> {
  const [{ title, cover, blocks }, executablePath] = await Promise.all([
    getPropuestaContent(pageId),
    warmChromiumExecutable(),
  ]);
  const rawHtml = buildRawWorkflowHtml(cover, blocks);
  const html = await renderHtmlToPreviewDocument(rawHtml, {
    preferCSSPageSize: true,
    executablePath,
  });
  return { title, html };
}

/** Genera el PDF a partir de la tarea de Notion usando el pipeline del workflow. */
export async function buildWorkflowProposalPdf(pageId: string): Promise<{ title: string; pdf: Buffer }> {
  const [{ title, cover, blocks }, executablePath] = await Promise.all([
    getPropuestaContent(pageId),
    warmChromiumExecutable(),
  ]);
  const html = buildRawWorkflowHtml(cover, blocks);
  const pdf = await renderHtmlToPdf(html, { preferCSSPageSize: true, executablePath });
  return { title, pdf };
}

export function sanitizeProposalFilename(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  return base.slice(0, 120) || "Propuesta";
}

export function buildPdfContentDisposition(title: string): string {
  const utf8Filename = `${sanitizeProposalFilename(title)}.pdf`;
  const asciiFilename = utf8Filename
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`;
}
