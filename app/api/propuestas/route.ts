import { NextResponse } from "next/server";
import { formatPropuestaFromText } from "@/lib/deepseek-propuesta";
import { extractDocumentText } from "@/lib/document-text";
import { createPropuestaPage } from "@/lib/notion-propuesta";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

export interface PropuestaApiSuccess {
  ok: true;
  pageId: string;
  pageUrl: string | null;
  taskTitle: string;
}

export interface PropuestaApiError {
  ok: false;
  error: string;
}

export type PropuestaApiResponse = PropuestaApiSuccess | PropuestaApiError;

function bad(error: string, status = 400) {
  return NextResponse.json<PropuestaApiResponse>({ ok: false, error }, { status });
}

function parseReviewers(raw: string): string[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
  } catch {
    // fallback CSV
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(request: Request): Promise<NextResponse<PropuestaApiResponse>> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("La petición debe enviarse como multipart/form-data.", 400);
  }

  const docFile = form.get("document");
  if (!(docFile instanceof File) || docFile.size === 0) {
    return bad("Sube un archivo PDF o DOCX en el campo document.");
  }

  const reviewerIds = parseReviewers(String(form.get("reviewers") ?? ""));
  const priorityRaw = String(form.get("priority") ?? "Media").trim();
  const allowedPriorities = new Set(["Alta", "Media", "Baja"]);
  const priority = allowedPriorities.has(priorityRaw) ? priorityRaw : "Media";

  try {
    const text = await extractDocumentText(docFile);
    if (!text.trim()) {
      return bad("No se pudo leer texto del documento. ¿Es un PDF escaneado?", 422);
    }

    const formatted = await formatPropuestaFromText(text);
    const page = await createPropuestaPage({ formatted, reviewerIds, priority });

    return NextResponse.json<PropuestaApiResponse>(
      {
        ok: true,
        pageId: page.id,
        pageUrl: "url" in page ? (page.url as string) : null,
        taskTitle: formatted.title,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ServiceError) return bad(err.message, err.status);
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/propuestas] Error:", err);
    return bad(`Error interno del servidor: ${message}`, 500);
  }
}
