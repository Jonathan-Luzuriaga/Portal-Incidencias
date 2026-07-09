import { NextResponse } from "next/server";
import { estructurarProformaDesdeTexto } from "@/lib/deepseek-proforma";
import type { ProformaEstructurada } from "@/lib/deepseek-proforma";
import type { ProformaActividadInput } from "@/lib/proforma-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";

export interface ProformaEstructurarSuccess {
  ok: true;
  descripcion: string;
  horasEstimadas: number;
  perfilSugerido: ProformaEstructurada["perfilSugerido"];
  actividades: ProformaActividadInput[];
  redactadoPorIa: boolean;
}

export interface ProformaEstructurarError {
  ok: false;
  error: string;
}

export type ProformaEstructurarResponse = ProformaEstructurarSuccess | ProformaEstructurarError;

function bad(error: string, status = 400) {
  return NextResponse.json<ProformaEstructurarError>({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<NextResponse<ProformaEstructurarResponse>> {
  let body: { textoBruto?: string; numActividades?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bad("Cuerpo JSON inválido.");
  }

  const textoBruto = String(body.textoBruto ?? "").trim();
  if (!textoBruto) {
    return bad("Falta el campo textoBruto.");
  }
  if (textoBruto.length > 15000) {
    return bad("El texto es demasiado largo (máx. 15 000 caracteres).");
  }

  const numActividades =
    typeof body.numActividades === "number" && body.numActividades > 0
      ? Math.min(Math.round(body.numActividades), 12)
      : undefined;

  try {
    const resultado = await estructurarProformaDesdeTexto(textoBruto, numActividades);

    return NextResponse.json<ProformaEstructurarSuccess>({
      ok: true,
      descripcion: resultado.descripcion,
      horasEstimadas: resultado.horasEstimadas,
      perfilSugerido: resultado.perfilSugerido,
      actividades: resultado.actividades,
      redactadoPorIa: resultado.redactadoPorIa,
    });
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.status >= 400 ? err.status : 500;
      return bad(err.message, status);
    }
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/proformas/estructurar] Error inesperado:", err);
    return bad(message, 500);
  }
}
