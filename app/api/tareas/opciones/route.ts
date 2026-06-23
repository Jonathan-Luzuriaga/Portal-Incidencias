import { NextResponse } from "next/server";
import { listParentTasks, listTeamUsers } from "@/lib/team-notion-meta";
import { resolveTeamProject } from "@/lib/team-profiles";
import { TeamOptionsApiResponse } from "@/lib/team-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json<TeamOptionsApiResponse>({ ok: false, error }, { status });
}

export async function GET(request: Request): Promise<NextResponse<TeamOptionsApiResponse>> {
  const { searchParams } = new URL(request.url);
  const projectRelationId = resolveTeamProject(searchParams.get("proyecto"));

  try {
    const [users, parents] = await Promise.all([
      listTeamUsers(),
      listParentTasks(projectRelationId),
    ]);

    return NextResponse.json<TeamOptionsApiResponse>({
      ok: true,
      users,
      parents,
    });
  } catch (err) {
    if (err instanceof ServiceError) {
      return bad(err.message, err.status);
    }
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/tareas/opciones] Error inesperado:", err);
    return bad(`Error interno del servidor: ${message}`, 500);
  }
}
