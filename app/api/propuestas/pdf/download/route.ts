import { NextResponse } from "next/server";
import {
  buildPdfContentDisposition,
  buildWorkflowProposalPdf,
} from "@/lib/propuesta-pdf/generate-workflow";
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
    const { title, pdf } = await buildWorkflowProposalPdf(pageId);
    const body = new Uint8Array(pdf);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildPdfContentDisposition(title),
        "Content-Length": String(body.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = err instanceof ServiceError ? err.status : 500;
    const error = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/propuestas/pdf/download] Error:", err);
    return NextResponse.json({ ok: false, error }, { status });
  }
}
