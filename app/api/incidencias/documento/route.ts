import { NextResponse } from "next/server";
import { extractIncidentsFromDocument } from "@/lib/deepseek-extract";
import {
  documentImageToFile,
  extractDocumentContent,
  extractDocumentText,
} from "@/lib/document-text";
import { processAndCreateIncident } from "@/lib/incident-pipeline";
import { resolveClientProject } from "@/lib/project-profiles";
import { IncidentApiResponse, ServiceError } from "@/lib/types";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json<IncidentApiResponse>({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<NextResponse<IncidentApiResponse>> {
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

  const clientProject = resolveClientProject(String(form.get("clientProject") ?? ""));

  try {
    const text = await extractDocumentText(docFile);
    const incidents = await extractIncidentsFromDocument(text, clientProject);
    const { imagesByIncident } = await extractDocumentContent(docFile, incidents.length);

    const created = [];
    for (let i = 0; i < incidents.length; i++) {
      const images = (imagesByIncident[i] ?? []).map(documentImageToFile);
      const result = await processAndCreateIncident(incidents[i], images);
      created.push(result);
    }

    const first = created[0];
    return NextResponse.json<IncidentApiResponse>(
      {
        ok: true,
        pageId: first.pageId,
        pageUrl: first.pageUrl,
        taskTitle: first.taskTitle,
        evidenceCount: first.evidenceCount,
        created,
        total: created.length,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ServiceError) return bad(err.message, err.status);
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/incidencias/documento] Error:", err);
    return bad(`Error interno del servidor: ${message}`, 500);
  }
}
