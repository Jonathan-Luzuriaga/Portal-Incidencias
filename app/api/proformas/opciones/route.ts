import { NextResponse } from "next/server";
import { listClientOptions } from "@/lib/team-notion-meta";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

export type ProformaOpcionesResponse =
  | { ok: true; clients: string[] }
  | { ok: false; error: string };

/** Opciones del formulario de proformas (Cliente desde Notion). */
export async function GET(): Promise<NextResponse<ProformaOpcionesResponse>> {
  try {
    const clients = await listClientOptions();
    return NextResponse.json({ ok: true, clients });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/proformas/opciones] Error:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
