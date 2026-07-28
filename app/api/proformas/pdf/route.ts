import { NextResponse } from "next/server";
import {
  parseRolEncargado,
  tarifaDefault,
  type RolEncargado,
} from "@/lib/proforma-calc";
import { formatCodigoProyecto } from "@/lib/proforma-codigos";
import { generarHtmlProforma } from "@/lib/proforma-pdf-template";
import { loadCorporateAssets } from "@/lib/propuesta-pdf/assets";
import { renderHtmlToPdf, warmChromiumExecutable } from "@/lib/propuesta-pdf/render";
import type { ProformaActividadInput } from "@/lib/proforma-types";
import { ServiceError } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export interface ProformaPdfBody {
  codigoProyecto: string;
  codigoEstimacion: string;
  descripcion: string;
  horas: number;
  actividades?: ProformaActividadInput[];
  esGarantia?: boolean;
}

function buildContentDisposition(codigoProyecto: string): string {
  const utf8Filename = `${codigoProyecto}.pdf`;
  const asciiFilename = utf8Filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`;
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

function parseValorHora(raw: unknown, rol: RolEncargado): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;
  return tarifaDefault(rol);
}

function parseActividades(raw: unknown): ProformaActividadInput[] {
  if (!Array.isArray(raw)) return [];
  const result: ProformaActividadInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<ProformaActividadInput>;
    const actividad = String(row.actividad ?? "").trim();
    const descripcion = String(row.descripcion ?? "").trim();
    const horasRaw = row.horas;
    const horas = typeof horasRaw === "number" ? horasRaw : Number(horasRaw);
    if (!actividad && !descripcion) continue;
    const rol = parseRolEncargado(row.rol);
    result.push({
      actividad,
      descripcion,
      horas: Number.isFinite(horas) && horas > 0 ? Math.round(horas) : 0,
      rol,
      valorHora: parseValorHora(row.valorHora, rol),
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
  const esGarantia = parseEsGarantia(body.esGarantia);
  const actividades = parseActividades(body.actividades);

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
  if (actividades.length === 0) {
    return { ok: false, error: "Debes incluir al menos una actividad con Rol/Encargado." };
  }

  return {
    ok: true,
    data: {
      codigoProyecto,
      codigoEstimacion: codigoEstimacionRaw,
      descripcion,
      horas,
      actividades,
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
