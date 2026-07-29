import { NextResponse } from "next/server";
import { listJornadaMembers } from "@/lib/jornada";
import type { JornadaOptionsResponse } from "@/lib/jornada-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse<JornadaOptionsResponse>> {
  try {
    const members = await listJornadaMembers();
    return NextResponse.json<JornadaOptionsResponse>({ ok: true, members });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json<JornadaOptionsResponse>(
        { ok: false, error: err.message },
        { status: err.status }
      );
    }
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/jornada/opciones] Error:", err);
    return NextResponse.json<JornadaOptionsResponse>({ ok: false, error: message }, { status: 500 });
  }
}
