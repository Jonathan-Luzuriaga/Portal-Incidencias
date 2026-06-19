import { NextResponse } from "next/server";
import { processAndCreateTeamTask } from "@/lib/team-pipeline";
import {
  resolveTeamClientProject,
  resolveTeamProject,
  TEAM_CATEGORY_OPTIONS,
  TEAM_CLIENT_PROJECT_OPTIONS,
  TEAM_PROJECT_OPTIONS,
} from "@/lib/team-profiles";
import {
  TEAM_CLIENTS,
  TEAM_PRIORITIES,
  TEAM_TICKET_TYPES,
  TeamTaskApiResponse,
  TeamTaskFormData,
  TeamClient,
  TeamPriority,
  TeamTicketType,
} from "@/lib/team-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

const MAX_FILES = 10;

function bad(error: string, status = 400) {
  return NextResponse.json<TeamTaskApiResponse>({ ok: false, error }, { status });
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseForm(
  form: FormData,
  rawInput: string,
  useAi: boolean
): TeamTaskFormData | string {
  const title = String(form.get("title") ?? "").trim();
  const shortDescription = String(form.get("shortDescription") ?? "").trim();
  const bodyMarkdown = String(form.get("bodyMarkdown") ?? "").trim();
  const ticketType = String(form.get("ticketType") ?? "").trim() as TeamTicketType;
  const priority = String(form.get("priority") ?? "").trim() as TeamPriority;
  const client = String(form.get("client") ?? "").trim() as TeamClient;
  const clientProject = resolveTeamClientProject(String(form.get("clientProject") ?? ""));
  const projectRelationId = resolveTeamProject(String(form.get("projectRelationId") ?? ""));
  const category = String(form.get("category") ?? "").trim();
  const tags = parseTags(String(form.get("tags") ?? ""));
  const prLink = String(form.get("prLink") ?? "").trim();
  const hoursRaw = String(form.get("hours") ?? "").trim();
  const hours = hoursRaw ? Number(hoursRaw) : null;

  const willUseAi = useAi || Boolean(rawInput && !title);

  if (!title && !rawInput) {
    return "El título es obligatorio (o pega una descripción en bruto).";
  }
  if (!shortDescription && !rawInput && !willUseAi) {
    return "La descripción corta es obligatoria (o pega una descripción en bruto).";
  }
  if (!TEAM_TICKET_TYPES.includes(ticketType)) return "Selecciona un tipo de ticket válido.";
  if (!TEAM_PRIORITIES.includes(priority)) return "Selecciona una prioridad válida.";
  if (!TEAM_CLIENTS.includes(client)) return "Selecciona un cliente válido.";
  if (!TEAM_CLIENT_PROJECT_OPTIONS.some((o) => o.value === clientProject)) {
    return "Selecciona un Proyecto Cliente válido.";
  }
  if (!TEAM_PROJECT_OPTIONS.some((o) => o.relationId === projectRelationId)) {
    return "Selecciona un proyecto válido.";
  }
  if (!willUseAi && !TEAM_CATEGORY_OPTIONS.includes(category as (typeof TEAM_CATEGORY_OPTIONS)[number])) {
    return "Selecciona una categoría válida.";
  }
  if (prLink && !/^https?:\/\//i.test(prLink)) {
    return "El enlace del PR debe ser una URL válida (http/https).";
  }
  if (hours != null && (Number.isNaN(hours) || hours < 0)) {
    return "Las horas deben ser un número positivo.";
  }

  return {
    title,
    shortDescription,
    bodyMarkdown,
    ticketType,
    priority,
    client,
    clientProject,
    projectRelationId,
    category,
    tags,
    prLink,
    hours,
  };
}

export async function POST(request: Request): Promise<NextResponse<TeamTaskApiResponse>> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("La petición debe enviarse como multipart/form-data.", 400);
  }

  const rawInput = String(form.get("rawInput") ?? "").trim();
  const useAi = String(form.get("useAi") ?? "") === "true";

  const parsed = parseForm(form, rawInput, useAi);
  if (typeof parsed === "string") return bad(parsed);

  const files = form
    .getAll("images")
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (files.length > MAX_FILES) {
    return bad(`Máximo ${MAX_FILES} imágenes por tarea.`);
  }
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return bad(`El archivo "${file.name}" no es una imagen.`);
    }
  }

  try {
    const result = await processAndCreateTeamTask(parsed, files, {
      rawDescription: rawInput,
      useAi: useAi || Boolean(rawInput && !parsed.title),
    });

    return NextResponse.json<TeamTaskApiResponse>(
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
    console.error("[/api/tareas] Error inesperado:", err);
    return bad(`Error interno del servidor: ${message}`, 500);
  }
}
