import { NextResponse } from "next/server";
import { renderHtmlToPdf, warmChromiumExecutable } from "@/lib/propuesta-pdf/render";
import { getPropuestaContent } from "@/lib/notion-propuesta-list";
import { buildProposalHtml } from "@/lib/propuesta-pdf/html";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function sanitizeFilename(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  return base.slice(0, 120) || "Propuesta";
}

function buildContentDisposition(title: string): string {
  const utf8Filename = `${sanitizeFilename(title)}.pdf`;
  const asciiFilename = utf8Filename
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("pageId")?.trim();

  if (!pageId) {
    return NextResponse.json({ ok: false, error: "Falta el parámetro pageId." }, { status: 400 });
  }

  try {
    const [{ title, cover, blocks }, executablePath] = await Promise.all([
      getPropuestaContent(pageId),
      warmChromiumExecutable(),
    ]);

    // Transcribe fielmente el contenido real de la propuesta en Notion.
    // No se usa IA ni cálculos: las tablas, horas y precios se toman tal cual
    // están escritos y aprobados en la página de Notion.
    const html = buildProposalHtml(cover, blocks);
    const pdf = await renderHtmlToPdf(html, { executablePath });

    const body = new Uint8Array(pdf);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildContentDisposition(title),
        "Content-Length": String(body.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = err instanceof ServiceError ? err.status : 500;
    const error = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/propuestas/pdf] Error:", err);
    return NextResponse.json({ ok: false, error }, { status });
  }
}
