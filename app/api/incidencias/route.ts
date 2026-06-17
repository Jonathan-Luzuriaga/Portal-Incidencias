import { NextResponse } from "next/server";
import { processAndCreateIncident } from "@/lib/incident-pipeline";
import { resolveClientProject, BAGO_CLIENT_PROJECT_OPTIONS } from "@/lib/project-profiles";
import {
  ENVIRONMENTS,
  IncidentApiResponse,
  IncidentFormData,
  PRIORITIES,
  Priority,
  ServiceError,
  Environment,
} from "@/lib/types";

export const runtime = "nodejs";

const MAX_FILES = 10;

function bad(error: string, status = 400) {
  return NextResponse.json<IncidentApiResponse>({ ok: false, error }, { status });
}

function parseForm(form: FormData): IncidentFormData | string {
  const clientProjectRaw = String(form.get("clientProject") ?? "").trim();
  const clientProject = resolveClientProject(clientProjectRaw);
  if (!BAGO_CLIENT_PROJECT_OPTIONS.some((o) => o.value === clientProject)) {
    return "Selecciona un Proyecto Cliente válido.";
  }
  const title = String(form.get("title") ?? "").trim();
  const priority = String(form.get("priority") ?? "").trim() as Priority;
  const justification = String(form.get("justification") ?? "").trim();
  const environment = String(form.get("environment") ?? "").trim() as Environment;
  const dateTime = String(form.get("dateTime") ?? "").trim();
  const userRole = String(form.get("userRole") ?? "").trim();
  const moduleUrl = String(form.get("moduleUrl") ?? "").trim();
  const browserDevice = String(form.get("browserDevice") ?? "").trim();
  const affectedRecordId = String(form.get("affectedRecordId") ?? "").trim();
  const summary = String(form.get("summary") ?? "").trim();
  const actualResult = String(form.get("actualResult") ?? "").trim();
  const expectedResult = String(form.get("expectedResult") ?? "").trim();

  if (!title) return "El título es obligatorio.";
  if (!PRIORITIES.includes(priority)) return "La prioridad debe ser Alto, Medio o Bajo.";
  if (!justification) return "La justificación / descripción es obligatoria.";
  if (!ENVIRONMENTS.includes(environment)) return "Selecciona un ambiente válido.";
  if (!userRole) return "El usuario / rol es obligatorio.";
  if (!moduleUrl) return "El módulo / URL es obligatorio.";
  if (!browserDevice) return "El navegador / dispositivo es obligatorio.";
  if (!affectedRecordId) return "El ID / registro afectado es obligatorio.";
  if (!summary) return "El resumen es obligatorio.";
  if (!actualResult) return "El resultado actual (pasos) es obligatorio.";
  if (!expectedResult) return "El resultado esperado es obligatorio.";

  return {
    clientProject,
    title,
    priority,
    justification,
    environment,
    dateTime: dateTime || new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" }),
    userRole,
    moduleUrl,
    browserDevice,
    affectedRecordId,
    summary,
    actualResult,
    expectedResult,
  };
}

export async function POST(request: Request): Promise<NextResponse<IncidentApiResponse>> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("La petición debe enviarse como multipart/form-data.", 400);
  }

  const parsed = parseForm(form);
  if (typeof parsed === "string") return bad(parsed);

  const files = form
    .getAll("images")
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (files.length > MAX_FILES) {
    return bad(`Máximo ${MAX_FILES} imágenes por reporte.`);
  }
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return bad(`El archivo "${file.name}" no es una imagen.`);
    }
  }

  try {
    const result = await processAndCreateIncident(parsed, files);

    return NextResponse.json<IncidentApiResponse>(
      {
        ok: true,
        pageId: result.pageId,
        pageUrl: result.pageUrl,
        taskTitle: result.taskTitle,
        evidenceCount: result.evidenceCount,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ServiceError) {
      return bad(err.message, err.status);
    }
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/incidencias] Error inesperado:", err);
    return bad(`Error interno del servidor: ${message}`, 500);
  }
}
