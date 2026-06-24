/** Estructura una propuesta (PDF/DOCX) en una tarea de Notion vía DeepSeek. */

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

const SYSTEM_PROMPT = `Eres un Project Manager senior de Manticore Labs. Recibes el texto en bruto de una PROPUESTA comercial/técnica (extraída de un PDF o DOCX) y la conviertes en una tarea de Notion COMPLETA y profesional, siguiendo EXACTAMENTE el formato corporativo de Manticore Labs.

Devuelve ÚNICAMENTE un JSON válido con esta forma:
{
  "code": "código referencial, ej. PS-2026-1706-01. Si no aparece, genera uno con formato PS-AAAA-DDMM-01 usando la fecha de la propuesta",
  "name": "nombre de la propuesta sin la palabra Propuesta ni comillas",
  "shortDescription": "resumen ejecutivo en 1-2 frases (máx. 240 caracteres)",
  "priority": "Alta | Media | Baja",
  "totalHours": número entero total de horas estimadas,
  "bodyMarkdown": "cuerpo en markdown siguiendo la PLANTILLA OBLIGATORIA"
}

PLANTILLA OBLIGATORIA de bodyMarkdown. TODAS las secciones son obligatorias y deben quedar completas. Usa tablas markdown con encabezado y separador (| --- |):

## Metadatos de la propuesta
| Propiedad | Valor |
| --- | --- |
| Nombre_Propuesta | ... |
| Codigo_Propuesta | ... |
| Version | 1.0.0 |
| Fecha_Propuesta | (fecha en texto, ej. 17 de junio del 2026) |
| Validez_Dias | 45 |
| Responsable_PM | ... |

## Objetivos
(2-3 párrafos describiendo el alcance funcional, técnico y económico)

## Descripción y metodología
(párrafo sobre la metodología SCRUM de Manticore Labs, seguido de la tabla de roles)
| Rol | Responsable |
| --- | --- |
| Product Owner | Cliente |
| Scrum Master | (nombre del PM) |
| QA | (nombre del QA) |
| Equipo de Desarrollo | Equipo de Manticore Labs |

## Responsabilidad del Proveedor
(párrafos sobre las responsabilidades de Manticore Labs)

## Responsabilidad del Cliente
(párrafos sobre las responsabilidades del cliente)

## Descripción de la solución
(párrafo introductorio)
### HU0XX - <título de la historia>
(necesidad redactada como "Como <rol>, se requiere ..." seguida de una lista de criterios de aceptación con guiones)
(repite una sección ### por CADA historia de usuario; si la propuesta no las define, dedúcelas del alcance)

## Personal
| Rol | Cantidad | Descripción del Rol |
| --- | --- | --- |
| Programador Full Stack Senior | 1 | ... |
| Revisor de Calidad de Software | 1 | ... |
| Project Manager | 1 | ... |

## Actividades
| Sistema/HU | Actividad | Descripción | Horas |
| --- | --- | --- | --- |
(una fila por actividad, cada una con sus horas)
| **Total** |  | **Horas estimadas** | **<suma>** |

## No Incluye
(lista con guiones de lo que NO cubre la cotización)

## Tiempos y costos de la solución
| Etapa | Tiempo estimado | Detalle |
| --- | --- | --- |
(filas por etapa: backend, frontend, pruebas, UAT, etc.)
(párrafo con la duración estimada del proyecto)
| Descripción | Precio |
| --- | --- |
| Desarrollo de la solución | $... |
| Subtotal | $... |
| I.V.A. | $... |
| Total | $... |

## Nota
(lista de condiciones de entrega y soporte)

## Forma de pago
(fases con su hito, entregables asociados y condición de pago, normalmente 50% inicio y 50% entrega)

## Conclusiones
(lista de conclusiones)

REGLAS CLAVE:
- TODAS las secciones deben quedar completas. Si la propuesta NO trae algún dato (objetivos, metodología, historias de usuario, actividades, horas, personal, costos, forma de pago, etc.), DEDÚCELO de forma profesional y coherente con la idea y el alcance descritos. NUNCA dejes una sección vacía ni escribas "no especificado".
- Conserva EXACTAMENTE los montos, horas, códigos HU, porcentajes y precios que SÍ aparezcan en el texto.
- Si faltan horas, estímalas por actividad de forma realista; la fila Total debe sumar todas las horas.
- Si faltan precios, estima Subtotal, I.V.A. (15%) y Total de forma coherente.
- Corrige errores evidentes de extracción (palabras partidas, espacios sobrantes), sin alterar cifras.
- priority: Alta si el documento marca urgencia o bloqueo; normalmente Media.`;

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
  return {
    code,
    name,
    title: buildTitle(code, name),
    shortDescription: name.slice(0, 240),
    bodyMarkdown: `## Resumen\n\n${raw.replace(/\s+/g, " ").trim().slice(0, 1800)}`,
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

  // Limitar tamaño del texto enviado al modelo.
  const content = raw.slice(0, 24000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Texto de la propuesta:\n\n${content}` },
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
