import { NextResponse } from "next/server";
import { buildWorkflowProposalPreviewHtml } from "@/lib/propuesta-pdf/generate-workflow";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("pageId")?.trim();

  if (!pageId) {
    return NextResponse.json({ ok: false, error: "Falta el parámetro pageId." }, { status: 400 });
  }

  try {
    const { title, html } = await buildWorkflowProposalPreviewHtml(pageId);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Proposal-Title": encodeURIComponent(title),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = err instanceof ServiceError ? err.status : 500;
    const error = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/propuestas/pdf/preview] Error:", err);
    return NextResponse.json({ ok: false, error }, { status });
  }
}
