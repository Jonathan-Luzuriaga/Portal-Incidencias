import {
  parseRolEncargado,
  ROL_DEFAULT,
  ROLES_ENCARGADO,
  tarifaDefault,
  type RolEncargado,
} from "./proforma-calc";
import { generarActividadesFallback, redactarDescripcionLocal } from "./proforma-redactar";
import type { ProformaActividadInput } from "./proforma-types";
import { ServiceError } from "./types";

const SYSTEM_PROMPT = `Eres un redactor técnico-comercial de Manticore Labs. Recibes una idea o requerimiento en bruto del cliente.

Devuelve ÚNICAMENTE un JSON válido:
{
  "descripcion": "alcance redactado profesionalmente para la línea principal (máx. 500 caracteres)",
  "horasEstimadas": número entero positivo,
  "actividades": [
    {
      "actividad": "nombre corto",
      "descripcion": "detalle de la tarea",
      "horas": número entero,
      "rol": "SENIOR" | "SEMI_SENIOR" | "JUNIOR" | "ARQUITECTO" | "DEVOPS"
    }
  ]
}

Reglas descripcion:
- Reescribe en tono formal; NO copies el texto tal cual.
- Infinitivo o tercera persona: "Implementar…", "Desarrollar…", "Sustituir…".

Reglas actividades:
- Genera el número de actividades indicado por el usuario (o 4 si no se indica).
- Cada actividad: nombre breve + descripción clara + horas enteras > 0 + rol.
- La SUMA de horas de todas las actividades DEBE ser exactamente igual a horasEstimadas.
- Cubre análisis, desarrollo, pruebas y cierre según el alcance.

Roles (Rol/Encargado):
- ARQUITECTO: diseño de solución, arquitectura, decisiones estructurales.
- DEVOPS: CI/CD, infraestructura, despliegues, pipelines.
- SENIOR: integraciones, módulos críticos, desarrollo avanzado.
- SEMI_SENIOR: desarrollo estándar de funcionalidades.
- JUNIOR: ajustes menores, UI simple, correcciones, documentación.`;

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export interface ProformaEstructurada {
  descripcion: string;
  horasEstimadas: number;
  actividades: ProformaActividadInput[];
  redactadoPorIa: boolean;
}

function parseDeepSeekJson(raw: string): Record<string, unknown> | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sanitizeHoras(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 8;
  return Math.round(n);
}

function inferHorasFromText(raw: string): number {
  const match = raw.match(/(\d+)\s*(?:h|hrs?|horas?)\b/i);
  if (!match) return 8;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 8;
}

function inferRolFromActividad(actividad: string, descripcion: string): RolEncargado {
  const text = `${actividad} ${descripcion}`.toLowerCase();
  if (/(arquitect|diseño de soluci[oó]n|diseño t[eé]cnico)/i.test(text)) return "ARQUITECTO";
  if (/(devops|ci\/?cd|pipeline|infra|despliegue|deploy)/i.test(text)) return "DEVOPS";
  if (/(integraci[oó]n|sap|cr[ií]tico|complej|senior)/i.test(text)) return "SENIOR";
  if (/(ajuste|menor|correcci[oó]n|texto|redacci[oó]n|label|bot[oó]n|documentaci[oó]n|prueba)/i.test(text)) {
    return "JUNIOR";
  }
  return ROL_DEFAULT;
}

function sanitizeActividades(
  raw: unknown,
  horasTotales: number,
  descripcion: string,
  cantidad?: number
): ProformaActividadInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return generarActividadesFallback(descripcion, horasTotales, cantidad);
  }

  const items: ProformaActividadInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<ProformaActividadInput> & { rol?: unknown };
    const actividad = String(row.actividad ?? "").trim().slice(0, 120);
    const desc = String(row.descripcion ?? "").trim().slice(0, 300);
    const horas = sanitizeHoras(row.horas);
    if (!actividad) continue;
    const rol = parseRolEncargado(row.rol, inferRolFromActividad(actividad, desc || actividad));
    items.push({
      actividad,
      descripcion: desc || actividad,
      horas,
      rol,
      valorHora: tarifaDefault(rol),
    });
    if (items.length >= 12) break;
  }

  if (items.length === 0) {
    return generarActividadesFallback(descripcion, horasTotales, cantidad);
  }

  const suma = items.reduce((a, b) => a + b.horas, 0);
  if (suma !== horasTotales && items.length > 0) {
    const diff = horasTotales - suma;
    items[items.length - 1] = {
      ...items[items.length - 1],
      horas: Math.max(1, items[items.length - 1].horas + diff),
    };
  }

  return items;
}

function sanitizeParsed(
  parsed: Record<string, unknown>,
  cantidadActividades?: number
): ProformaEstructurada {
  const descripcion = String(parsed.descripcion ?? "").trim().slice(0, 500);
  if (!descripcion) {
    throw new ServiceError("La IA no devolvió una descripción válida.", 502);
  }

  const horasEstimadas = sanitizeHoras(parsed.horasEstimadas);

  return {
    descripcion,
    horasEstimadas,
    actividades: sanitizeActividades(parsed.actividades, horasEstimadas, descripcion, cantidadActividades),
    redactadoPorIa: true,
  };
}

function buildFallback(raw: string, cantidadActividades?: number): ProformaEstructurada {
  const descripcion = redactarDescripcionLocal(raw);
  const horasEstimadas = inferHorasFromText(raw);
  return {
    descripcion,
    horasEstimadas,
    actividades: generarActividadesFallback(descripcion, horasEstimadas, cantidadActividades),
    redactadoPorIa: false,
  };
}

function isSameAsRaw(descripcion: string, raw: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return norm(descripcion) === norm(raw);
}

export async function estructurarProformaDesdeTexto(
  textoBruto: string,
  cantidadActividades?: number
): Promise<ProformaEstructurada> {
  const raw = textoBruto.trim();
  if (!raw) {
    throw new ServiceError("El texto en bruto está vacío.", 400);
  }

  const fallback = buildFallback(raw, cantidadActividades);
  const cantidadHint =
    cantidadActividades && cantidadActividades > 0
      ? `Genera exactamente ${cantidadActividades} actividades.`
      : "Genera 4 actividades.";

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[deepseek-proforma] DEEPSEEK_API_KEY no configurada. Se usa redacción local.");
    return fallback;
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `Roles permitidos: ${ROLES_ENCARGADO.join(", ")}`,
              cantidadHint,
              "",
              "Requerimiento en bruto:",
              raw,
            ].join("\n"),
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[deepseek-proforma] HTTP ${res.status}. Se usa redacción local.`);
      return fallback;
    }

    const json = (await res.json()) as DeepSeekResponse;
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return fallback;

    const parsed = parseDeepSeekJson(content);
    if (!parsed?.descripcion) {
      console.warn("[deepseek-proforma] JSON inválido. Se usa redacción local.");
      return fallback;
    }

    const result = sanitizeParsed(parsed, cantidadActividades);

    if (isSameAsRaw(result.descripcion, raw)) {
      return {
        ...fallback,
        horasEstimadas: result.horasEstimadas,
        actividades: result.actividades,
      };
    }

    return result;
  } catch (err) {
    console.warn("[deepseek-proforma] Error:", err);
    return fallback;
  }
}
