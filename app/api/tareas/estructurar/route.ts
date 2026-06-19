import { NextResponse } from "next/server";
import { formatTeamTaskFromRaw } from "@/lib/deepseek-team";
import { resolveTeamClientProject } from "@/lib/team-profiles";
import {
  TeamClient,
  TeamStructureApiResponse,
  TEAM_CLIENTS,
} from "@/lib/team-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json<TeamStructureApiResponse>({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<NextResponse<TeamStructureApiResponse>> {
  let body: { rawDescription?: string; clientProject?: string; client?: string };
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

  const clientProject = resolveTeamClientProject(body.clientProject);
  const clientRaw = String(body.client ?? "").trim() as TeamClient;
  const client = TEAM_CLIENTS.includes(clientRaw) ? clientRaw : undefined;

  try {
    const formatted = await formatTeamTaskFromRaw(rawDescription, { clientProject, client });

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
