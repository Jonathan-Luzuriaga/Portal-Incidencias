import { NextResponse } from "next/server";
import {
  listClientProjectOptions,
  listNotionProjects,
  listParentTasks,
  listTeamUsers,
} from "@/lib/team-notion-meta";
import { resolveTeamProject } from "@/lib/team-profiles";
import { TeamOptionsApiResponse } from "@/lib/team-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json<TeamOptionsApiResponse>({ ok: false, error }, { status });
}

export async function GET(request: Request): Promise<NextResponse<TeamOptionsApiResponse>> {
  const { searchParams } = new URL(request.url);
  const proyectoParam = searchParams.get("proyecto");

  try {
    const [users, projects, clientProjects] = await Promise.all([
      listTeamUsers(),
      listNotionProjects(),
      listClientProjectOptions(),
    ]);

    const projectRelationId = resolveTeamProject(proyectoParam, projects);
    const parents = await listParentTasks(projectRelationId);

    return NextResponse.json<TeamOptionsApiResponse>({
      ok: true,
      users,
      projects,
      clientProjects,
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
