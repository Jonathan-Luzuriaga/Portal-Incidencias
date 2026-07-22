import { NextResponse } from "next/server";
import { TARIFAS_MANTICORE, type PerfilDesarrollador } from "@/lib/proforma-calc";
import { formatCodigoProyecto } from "@/lib/proforma-codigos";
import { generarHtmlProforma } from "@/lib/proforma-pdf-template";
import { loadCorporateAssets } from "@/lib/propuesta-pdf/assets";
import { renderHtmlToPdf, warmChromiumExecutable } from "@/lib/propuesta-pdf/render";
import type { ProformaActividadInput } from "@/lib/proforma-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const PERFILES = Object.keys(TARIFAS_MANTICORE) as PerfilDesarrollador[];

export interface ProformaPdfBody {
  codigoProyecto: string;
  codigoEstimacion: string;
  descripcion: string;
  horas: number;
  perfil: PerfilDesarrollador;
  actividades?: ProformaActividadInput[];
  esGarantia?: boolean;
}

function buildContentDisposition(codigoProyecto: string): string {
  const utf8Filename = `${codigoProyecto}.pdf`;
  const asciiFilename = utf8Filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`;
}

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

function validatePdfInput(body: {
  codigoProyecto?: unknown;
  codigoEstimacion?: unknown;
  descripcion?: unknown;
  horas?: unknown;
  perfil?: unknown;
  actividades?: unknown;
  esGarantia?: unknown;
}): {
  ok: true;
  data: ProformaPdfBody;
} | { ok: false; error: string } {
  const codigoProyectoRaw = String(body.codigoProyecto ?? "").trim();
  const codigoEstimacionRaw = String(body.codigoEstimacion ?? "").trim();
  const descripcion = String(body.descripcion ?? "").trim();
  const horas = parseHoras(body.horas);
  const perfil = parsePerfil(body.perfil);
  const esGarantia = parseEsGarantia(body.esGarantia);

  const codigoProyecto = formatCodigoProyecto(codigoProyectoRaw);
  if (!codigoProyecto) {
    return { ok: false, error: "Falta codigoProyecto (ej. 6871 → PROY-6871)." };
  }
  if (!codigoEstimacionRaw) {
    return { ok: false, error: "Falta codigoEstimacion (ej. 5 → EST-000005)." };
  }
  if (!descripcion) {
    return { ok: false, error: "Falta descripcion." };
  }
  if (horas === null) {
    return { ok: false, error: "horas debe ser un número entero mayor a 0." };
  }
  if (!perfil) {
    return { ok: false, error: `perfil debe ser uno de: ${PERFILES.join(", ")}.` };
  }

  return {
    ok: true,
    data: {
      codigoProyecto,
      codigoEstimacion: codigoEstimacionRaw,
      descripcion,
      horas,
      perfil,
      actividades: parseActividades(body.actividades),
      esGarantia,
    },
  };
}

async function renderPdfResponse(data: ProformaPdfBody): Promise<Response> {
  const html = generarHtmlProforma({
    ...data,
    logoSrc: resolveLogoSrc(),
  });
  const executablePath = await warmChromiumExecutable();
  const pdf = await renderHtmlToPdf(html, { executablePath });
  const body = new Uint8Array(pdf);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildContentDisposition(data.codigoProyecto),
      "Content-Length": String(body.length),
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: Partial<ProformaPdfBody>;
  try {
    body = (await request.json()) as Partial<ProformaPdfBody>;
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const validated = validatePdfInput(body);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  try {
    return await renderPdfResponse(validated.data);
  } catch (err) {
    const status = err instanceof ServiceError ? err.status : 500;
    const error = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/proformas/pdf] POST Error:", err);
    return NextResponse.json({ ok: false, error }, { status });
  }
}

function parseActividadesFromQuery(raw: string | null): unknown {
  if (!raw?.trim()) return [];
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
}

/** GET con query params: permite abrir el PDF en pestaña nueva (p. ej. desde Notion). */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const validated = validatePdfInput({
    codigoProyecto: searchParams.get("codigoProyecto") ?? "",
    codigoEstimacion: searchParams.get("codigoEstimacion") ?? "",
    descripcion: searchParams.get("descripcion") ?? "",
    horas: searchParams.get("horas") ?? "",
    perfil: searchParams.get("perfil") ?? "",
    actividades: parseActividadesFromQuery(searchParams.get("actividades")),
    esGarantia: searchParams.get("esGarantia") ?? "",
  });

  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  try {
    return await renderPdfResponse(validated.data);
  } catch (err) {
    const status = err instanceof ServiceError ? err.status : 500;
    const error = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[/api/proformas/pdf] GET Error:", err);
    return NextResponse.json({ ok: false, error }, { status });
  }
}
