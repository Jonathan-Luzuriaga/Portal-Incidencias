import { NextResponse } from "next/server";
import {
  getProjectFieldMode,
  listClientProjectOptions,
  listNotionProjects,
  listParentTasks,
  listTagOptions,
  listTeamUsers,
} from "@/lib/team-notion-meta";
import { TeamOptionsApiResponse } from "@/lib/team-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json<TeamOptionsApiResponse>({ ok: false, error }, { status });
}

export async function GET(): Promise<NextResponse<TeamOptionsApiResponse>> {
  try {
    const [usersR, projectsR, clientProjectsR, parentsR, projectModeR, tagsR] =
      await Promise.allSettled([
      listTeamUsers(),
      listNotionProjects(),
      listClientProjectOptions(),
      listParentTasks(),
      getProjectFieldMode(),
      listTagOptions(),
    ]);

    if (usersR.status === "rejected") {
      const err = usersR.reason;
      if (err instanceof ServiceError) return bad(err.message, err.status);
      throw err;
    }

    for (const r of [projectsR, clientProjectsR, parentsR]) {
      if (r.status === "rejected") {
        console.error("[/api/tareas/opciones] Falla parcial:", r.reason);
      }
    }

    return NextResponse.json<TeamOptionsApiResponse>({
      ok: true,
      users: usersR.value,
      projects: projectsR.status === "fulfilled" ? projectsR.value : [],
      projectFieldMode:
        projectModeR.status === "fulfilled" ? projectModeR.value : "relation",
      clientProjects: clientProjectsR.status === "fulfilled" ? clientProjectsR.value : [],
      parents: parentsR.status === "fulfilled" ? parentsR.value : [],
      tagSuggestions: tagsR.status === "fulfilled" ? tagsR.value : [],
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
