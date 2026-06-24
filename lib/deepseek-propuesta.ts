/** Estructura una propuesta (PDF/DOCX) en una tarea de Notion vía DeepSeek. */

import { readFileSync } from "fs";
import { join } from "path";

export interface FormattedPropuesta {
  code: string;
  name: string;
  title: string;
  shortDescription: string;
  bodyMarkdown: string;
  priority: "Alta" | "Media" | "Baja";
  totalHours: number | null;
}

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

const PRIORITIES = ["Alta", "Media", "Baja"] as const;

let cachedReference: string | null = null;

function getPropuestaReferenceTemplate(): string {
  if (cachedReference) return cachedReference;
  const path = join(process.cwd(), "lib", "propuesta-reference.md");
  cachedReference = readFileSync(path, "utf-8");
  return cachedReference;
}

function buildSystemPrompt(): string {
  const reference = getPropuestaReferenceTemplate();
  return `Eres un Project Manager senior de Manticore Labs. Recibes el texto en bruto de una PROPUESTA comercial/técnica (extraída de un PDF o DOCX) y la conviertes en una tarea de Notion.

Devuelve ÚNICAMENTE un JSON válido con esta forma:
{
  "code": "código referencial, ej. PS-2026-1706-01",
  "name": "nombre de la propuesta sin la palabra Propuesta ni comillas",
  "shortDescription": "resumen ejecutivo en 1-2 frases (máx. 240 caracteres)",
  "priority": "Alta | Media | Baja",
  "totalHours": número entero total de horas estimadas,
  "bodyMarkdown": "cuerpo en markdown IDÉNTICO en estructura al DOCUMENTO DE REFERENCIA"
}

El campo bodyMarkdown DEBE replicar EXACTAMENTE la estructura del DOCUMENTO DE REFERENCIA:
- Mismas secciones, en el mismo orden
- Mismos títulos (##, ###, #)
- Divisores --- entre cada sección principal
- Mismas columnas en cada tabla
- Mismos bloques fijos: MANTICORE LABS, Imagen 1-4, metodología SCRUM, NOTA de despliegues, pie con info@manticore-labs.com
- Índice con una fila por cada sección y cada HU
- Forma de pago con Fase 1 y Fase 2 (Hito, Entregables asociados, Condición de pago)
- Citas con > donde aparecen en la referencia

Solo cambia los VALORES y TEXTOS según la propuesta subida. NO omitas ninguna sección.

Si la propuesta NO trae algún dato (objetivos, HUs, actividades, horas, costos, forma de pago, etc.), DEDÚCELO de forma profesional y coherente con el alcance. NUNCA dejes una sección vacía.

Conserva EXACTAMENTE montos, horas, códigos HU y precios que SÍ aparezcan en el texto.
Si faltan horas, estímalas por actividad; la fila Total debe sumar todas.
Si faltan precios, calcula Subtotal, I.V.A. (15%) y Total de forma coherente.
priority: normalmente Media.

DOCUMENTO DE REFERENCIA (estructura obligatoria — reemplaza contenido, no formato):

${reference}`;
}

function pickPriority(value: unknown, fallback: FormattedPropuesta["priority"]): FormattedPropuesta["priority"] {
  if (typeof value === "string" && (PRIORITIES as readonly string[]).includes(value)) {
    return value as FormattedPropuesta["priority"];
  }
  return fallback;
}

function deriveCodeName(raw: string): { code: string; name: string } {
  const codeMatch = raw.match(/PS[-\s]?\d{4}[-\s]?\d{3,4}[-\s]?\d{1,2}/i);
  const code = codeMatch ? codeMatch[0].replace(/\s+/g, "-").toUpperCase() : "";

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const idx = lines.findIndex((l) => /^propuesta/i.test(l));
  let name = "";
  if (idx !== -1) {
    for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
      const candidate = lines[i].replace(/^["“”]|["“”]$/g, "").trim();
      if (candidate.length > 4 && !/^propuesta$/i.test(candidate) && !/n[úu]mero/i.test(candidate)) {
        name = candidate.replace(/["“”]/g, "");
        break;
      }
    }
  }
  if (!name) name = lines.find((l) => l.length > 8) ?? "Propuesta";
  return { code, name: name.slice(0, 160) };
}

function buildTitle(code: string, name: string): string {
  const clean = name.replace(/["“”]/g, "").trim();
  return code ? `Propuesta — ${code} ${clean}` : `Propuesta — ${clean}`;
}

function buildFallback(raw: string): FormattedPropuesta {
  const { code, name } = deriveCodeName(raw);
  const hoursMatch = raw.match(/total[^0-9]{0,30}?(\d{2,4})\s*(?:horas|h)/i);
  let bodyMarkdown: string;
  try {
    bodyMarkdown = getPropuestaReferenceTemplate();
  } catch {
    bodyMarkdown = `## Metadatos de la propuesta\n\n${raw.replace(/\s+/g, " ").trim().slice(0, 1800)}`;
  }
  return {
    code,
    name,
    title: buildTitle(code, name),
    shortDescription: name.slice(0, 240),
    bodyMarkdown,
    priority: "Media",
    totalHours: hoursMatch ? Number(hoursMatch[1]) : null,
  };
}

function parseJson(raw: string): Record<string, unknown> | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function formatPropuestaFromText(rawText: string): Promise<FormattedPropuesta> {
  const raw = rawText.trim();
  const fallback = buildFallback(raw);

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[deepseek-propuesta] DEEPSEEK_API_KEY no configurada. Se usa fallback.");
    return fallback;
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  const content = raw.slice(0, 32000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 12000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: `Texto de la propuesta a estructurar:\n\n${content}` },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[deepseek-propuesta] HTTP ${res.status}. Se usa fallback.`);
      return fallback;
    }

    const json = (await res.json()) as DeepSeekResponse;
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return fallback;

    const parsed = parseJson(text);
    if (!parsed) return fallback;

    const code = String(parsed.code ?? fallback.code).trim();
    const name = String(parsed.name ?? fallback.name).replace(/["“”]/g, "").trim() || fallback.name;
    const bodyMarkdown = String(parsed.bodyMarkdown ?? "").trim() || fallback.bodyMarkdown;
    const shortDescription =
      String(parsed.shortDescription ?? "").trim().slice(0, 240) || fallback.shortDescription;
    const totalHours =
      typeof parsed.totalHours === "number" && parsed.totalHours > 0
        ? parsed.totalHours
        : fallback.totalHours;

    return {
      code,
      name,
      title: buildTitle(code, name),
      shortDescription,
      bodyMarkdown,
      priority: pickPriority(parsed.priority, fallback.priority),
      totalHours,
    };
  } catch (err) {
    console.warn("[deepseek-propuesta] Error:", err);
    return fallback;
  }
}
