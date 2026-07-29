import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listMyTasks } from "@/lib/jornada";
import { listTeamUsers } from "@/lib/team-notion-meta";
import type { JornadaTasksResponse, JornadaUserOption } from "@/lib/jornada-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse<JornadaTasksResponse>> {
  const params = request.nextUrl.searchParams;
  const responsable = (params.get("responsable") ?? "").trim() || undefined;
  const onlyCurrentSprint = params.get("sprint") === "1";

  try {
    const [tasks, usersRaw] = await Promise.all([
      listMyTasks(responsable, onlyCurrentSprint),
      listTeamUsers().catch(() => []),
    ]);
    const users: JornadaUserOption[] = usersRaw.map((u) => ({ id: u.id, name: u.name }));
    return NextResponse.json<JornadaTasksResponse>({ ok: true, tasks, users });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json<JornadaTasksResponse>(
        { ok: false, error: err.message },
        { status: err.status }
      );
    }
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/jornada/tareas] Error:", err);
    return NextResponse.json<JornadaTasksResponse>({ ok: false, error: message }, { status: 500 });
  }
}
