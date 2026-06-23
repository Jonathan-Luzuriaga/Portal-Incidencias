import { NextResponse } from "next/server";
import { formatTeamTaskFromRaw } from "@/lib/deepseek-team";
import {
  getProjectMetadata,
  resolveTeamProject,
  TEAM_PROJECT_OPTIONS,
} from "@/lib/team-profiles";
import {
  TeamStructureApiResponse,
  TEAM_TICKET_TYPES,
  TeamTicketType,
} from "@/lib/team-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json<TeamStructureApiResponse>({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<NextResponse<TeamStructureApiResponse>> {
  let body: {
    rawDescription?: string;
    ticketType?: string;
    projectRelationId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bad("Cuerpo JSON inválido.", 400);
  }

  const rawDescription = String(body.rawDescription ?? "").trim();
  if (!rawDescription) {
    return bad("Pega una descripción en bruto para estructurar.");
  }
  if (rawDescription.length > 15000) {
    return bad("La descripción es demasiado larga (máx. 15 000 caracteres).");
  }

  const ticketTypeRaw = String(body.ticketType ?? "Tarea").trim() as TeamTicketType;
  const ticketType = TEAM_TICKET_TYPES.includes(ticketTypeRaw) ? ticketTypeRaw : "Tarea";
  const projectRelationId = resolveTeamProject(body.projectRelationId);
  const projectLabel =
    TEAM_PROJECT_OPTIONS.find((p) => p.relationId === projectRelationId)?.label ?? "";
  const meta = getProjectMetadata(projectRelationId);

  try {
    const formatted = await formatTeamTaskFromRaw(rawDescription, {
      ticketType,
      clientProject: meta.clientProject,
      client: meta.client,
      projectLabel,
    });

    return NextResponse.json<TeamStructureApiResponse>({ ok: true, formatted });
  } catch (err) {
    if (err instanceof ServiceError) {
      return bad(err.message, err.status);
    }
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/tareas/estructurar] Error inesperado:", err);
    return bad(`Error interno del servidor: ${message}`, 500);
  }
}
