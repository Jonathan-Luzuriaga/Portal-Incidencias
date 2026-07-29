import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createJornadaEntry, getJornadaTotals, updateJornadaEntry } from "@/lib/jornada";
import type {
  CreateJornadaInput,
  JornadaApiResponse,
  JornadaCreateResponse,
  JornadaUpdateResponse,
  UpdateJornadaInput,
} from "@/lib/jornada-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function bad(error: string, status = 400): NextResponse<JornadaApiResponse> {
  return NextResponse.json<JornadaApiResponse>({ ok: false, error }, { status });
}

export async function GET(request: NextRequest): Promise<NextResponse<JornadaApiResponse>> {
  const params = request.nextUrl.searchParams;
  const member = (params.get("miembro") ?? "").trim();
  const desde = (params.get("desde") ?? "").trim();
  const hasta = (params.get("hasta") ?? "").trim();

  if (!member) return bad("Selecciona un miembro del equipo.");
  if (!DATE_RE.test(desde) || !DATE_RE.test(hasta)) {
    return bad("Fechas inválidas: usa el formato YYYY-MM-DD.");
  }

  try {
    const totals = await getJornadaTotals(member, desde, hasta);
    return NextResponse.json<JornadaApiResponse>({ ok: true, totals });
  } catch (err) {
    if (err instanceof ServiceError) return bad(err.message, err.status);
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/jornada] Error:", err);
    return bad(message, 500);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<JornadaCreateResponse>> {
  let input: CreateJornadaInput;
  try {
    input = (await request.json()) as CreateJornadaInput;
  } catch {
    return NextResponse.json<JornadaCreateResponse>(
      { ok: false, error: "Cuerpo JSON inválido." },
      { status: 400 }
    );
  }

  try {
    const { id, url, totalLabel } = await createJornadaEntry({
      member: input.member,
      title: input.title,
      startDate: input.startDate,
      startTime: input.startTime,
      endDate: input.endDate,
      endTime: input.endTime,
      taskIds: Array.isArray(input.taskIds) ? input.taskIds : [],
      responsableId: input.responsableId,
    });
    return NextResponse.json<JornadaCreateResponse>({ ok: true, page: { id, url }, totalLabel });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json<JornadaCreateResponse>(
        { ok: false, error: err.message },
        { status: err.status }
      );
    }
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/jornada] POST Error:", err);
    return NextResponse.json<JornadaCreateResponse>({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse<JornadaUpdateResponse>> {
  let input: UpdateJornadaInput;
  try {
    input = (await request.json()) as UpdateJornadaInput;
  } catch {
    return NextResponse.json<JornadaUpdateResponse>(
      { ok: false, error: "Cuerpo JSON inválido." },
      { status: 400 }
    );
  }

  try {
    const { id, url, totalLabel, entry } = await updateJornadaEntry({
      pageId: input.pageId,
      title: input.title,
      startDate: input.startDate,
      startTime: input.startTime,
      endDate: input.endDate,
      endTime: input.endTime,
      taskIds: Array.isArray(input.taskIds) ? input.taskIds : undefined,
    });
    return NextResponse.json<JornadaUpdateResponse>({
      ok: true,
      page: { id, url },
      totalLabel,
      entry,
    });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json<JornadaUpdateResponse>(
        { ok: false, error: err.message },
        { status: err.status }
      );
    }
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/jornada] PATCH Error:", err);
    return NextResponse.json<JornadaUpdateResponse>({ ok: false, error: message }, { status: 500 });
  }
}
