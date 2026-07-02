import { NextResponse } from "next/server";
import { listPropuestas, type PropuestaListItem } from "@/lib/notion-propuesta-list";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

export interface PropuestaListSuccess {
  ok: true;
  propuestas: PropuestaListItem[];
}

export interface PropuestaListError {
  ok: false;
  error: string;
}

export type PropuestaListResponse = PropuestaListSuccess | PropuestaListError;

export async function GET(): Promise<NextResponse<PropuestaListResponse>> {
  try {
    const propuestas = await listPropuestas();
    return NextResponse.json<PropuestaListResponse>({ ok: true, propuestas });
  } catch (err) {
    const status = err instanceof ServiceError ? err.status : 500;
    const error = err instanceof Error ? err.message : "Error interno del servidor.";
    return NextResponse.json<PropuestaListResponse>({ ok: false, error }, { status });
  }
}
