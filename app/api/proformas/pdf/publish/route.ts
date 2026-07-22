import { NextResponse } from "next/server";
import { TARIFAS_MANTICORE, type PerfilDesarrollador } from "@/lib/proforma-calc";
import { formatCodigoProyecto } from "@/lib/proforma-codigos";
import { createProformaPdfPage } from "@/lib/notion-proforma-publish";
import { generarHtmlProforma } from "@/lib/proforma-pdf-template";
import { loadCorporateAssets } from "@/lib/propuesta-pdf/assets";
import { renderHtmlToPdf, warmChromiumExecutable } from "@/lib/propuesta-pdf/render";
import type { ProformaActividadInput } from "@/lib/proforma-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const PERFILES = Object.keys(TARIFAS_MANTICORE) as PerfilDesarrollador[];

export type ProformaPublishResponse =
  | {
      ok: true;
      pageId: string;
      pageUrl: string;
      filename: string;
    }
  | { ok: false; error: string };

function parsePerfil(raw: unknown): PerfilDesarrollador | null {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value) return null;
  if (PERFILES.includes(value as PerfilDesarrollador)) {
    return value as PerfilDesarrollador;
  }
  return null;
}

function parseHoras(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function parseEsGarantia(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw === 1;
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  return value === "1" || value === "true" || value === "si" || value === "sí" || value === "yes";
}

function parseActividades(raw: unknown): ProformaActividadInput[] {
  if (!Array.isArray(raw)) return [];
  const result: ProformaActividadInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const actividad = String((item as ProformaActividadInput).actividad ?? "").trim();
    const descripcion = String((item as ProformaActividadInput).descripcion ?? "").trim();
    const horasRaw = (item as ProformaActividadInput).horas;
    const horas = typeof horasRaw === "number" ? horasRaw : Number(horasRaw);
    if (!actividad && !descripcion) continue;
    result.push({
      actividad,
      descripcion,
      horas: Number.isFinite(horas) && horas > 0 ? Math.round(horas) : 0,
    });
  }
  return result;
}

function resolveLogoSrc(): string {
  const assets = loadCorporateAssets();
  return assets["manticore-logo-full.png"] || assets["manticorelogoazul.png"] || "";
}

/** Publica el PDF de la proforma en Notion (tarea + archivo adjunto). */
export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Cuerpo JSON inválido." } satisfies ProformaPublishResponse,
      { status: 400 }
    );
  }

  const codigoProyectoRaw = String(body.codigoProyecto ?? "").trim();
  const codigoEstimacionRaw = String(body.codigoEstimacion ?? "").trim();
  const descripcion = String(body.descripcion ?? "").trim();
  const horas = parseHoras(body.horas);
  const perfil = parsePerfil(body.perfil);
  const cliente = String(body.cliente ?? "").trim();
  const esGarantia = parseEsGarantia(body.esGarantia);
  const codigoProyecto = formatCodigoProyecto(codigoProyectoRaw);

  if (!codigoProyecto) {
    return NextResponse.json(
      { ok: false, error: "Falta codigoProyecto (ej. 6871 → PROY-6871)." } satisfies ProformaPublishResponse,
      { status: 400 }
    );
  }
  if (!codigoEstimacionRaw) {
    return NextResponse.json(
      { ok: false, error: "Falta codigoEstimacion (ej. 5 → EST-000005)." } satisfies ProformaPublishResponse,
      { status: 400 }
    );
  }
  if (!descripcion) {
    return NextResponse.json(
      { ok: false, error: "Falta descripcion." } satisfies ProformaPublishResponse,
      { status: 400 }
    );
  }
  if (!cliente) {
    return NextResponse.json(
      { ok: false, error: "Falta cliente (columna Cliente de Notion)." } satisfies ProformaPublishResponse,
      { status: 400 }
    );
  }
  if (horas === null) {
    return NextResponse.json(
      { ok: false, error: "horas debe ser un número entero mayor a 0." } satisfies ProformaPublishResponse,
      { status: 400 }
    );
  }
  if (!perfil) {
    return NextResponse.json(
      {
        ok: false,
        error: `perfil debe ser uno de: ${PERFILES.join(", ")}.`,
      } satisfies ProformaPublishResponse,
      { status: 400 }
    );
  }

  try {
    const actividades = parseActividades(body.actividades);
    const html = generarHtmlProforma({
      codigoProyecto,
      codigoEstimacion: codigoEstimacionRaw,
      descripcion,
      horas,
      perfil,
      actividades,
      esGarantia,
      logoSrc: resolveLogoSrc(),
    });
    const executablePath = await warmChromiumExecutable();
    const pdf = await renderHtmlToPdf(html, { executablePath });

    const published = await createProformaPdfPage({
      codigoProyecto,
      codigoEstimacion: codigoEstimacionRaw,
      descripcion,
      horas,
      perfil,
      actividades,
      esGarantia,
      pdf,
      cliente,
    });

    const payload: ProformaPublishResponse = {
      ok: true,
      pageId: published.page.id,
      pageUrl: published.pageUrl,
      filename: published.filename,
    };
    return NextResponse.json(payload);
  } catch (err) {
    const status = err instanceof ServiceError ? err.status : 500;
    const error = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/proformas/pdf/publish] Error:", err);
    return NextResponse.json({ ok: false, error } satisfies ProformaPublishResponse, { status });
  }
}
