/**
 * Convierte el contenido de una propuesta de Notion en el JSON estructurado que
 * alimenta la plantilla corporativa (PDF). Las reglas de maquetación provienen de
 * lib/propuesta-pdf/instructions/ (3.1, 3.2, 4.2, Tarifario) y van embebidas en el
 * prompt para garantizar que viajen en el bundle serverless.
 *
 * DeepSeek NO calcula precios ni horas: solo extrae/estima el contenido y las
 * SEMANAS por actividad. Los importes y el esquema de pago se calculan en calc.ts.
 */
import { ACTIVITY_ORDER } from "./propuesta-pdf/calc";
import type {
  Complejidad,
  CorporateActivity,
  CorporateCover,
  CorporateModule,
  CorporatePersonal,
  CorporateProposalContent,
  CorporateRequirement,
} from "./propuesta-pdf/corporate-types";

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

const COMPLEJIDADES: Complejidad[] = ["Simple", "Medio", "Medio-alto", "Complejo"];

function buildSystemPrompt(): string {
  return `Eres un Project Manager senior de Manticore Labs. Recibes el contenido de una PROPUESTA (extraído de una página de Notion) y lo conviertes en un JSON estructurado para maquetar el PDF corporativo.

Devuelve ÚNICAMENTE un JSON válido con EXACTAMENTE esta forma:
{
  "scrumMaster": "nombre del PM/Scrum Master, o 'Manticore Labs' si no aparece",
  "qaResponsable": "nombre del QA, o 'Manticore Labs' si no aparece",
  "objetivos": ["objetivo 1", "objetivo 2", "objetivo 3"],
  "modulos": [
    { "nombre": "máx 6 palabras", "complejidad": "Simple|Medio|Medio-alto|Complejo", "descripcion": "1-2 oraciones", "funcionalidades": ["bullet 1", "bullet 2"] }
  ],
  "personal": [
    { "rol": "rol del tarifario", "cantidad": 1, "descripcion": "descripción sin tarifas" }
  ],
  "actividades": [
    { "descripcion": "1 oración corta", "semanas": 2 }
  ],
  "requerimientos": [
    { "nombre": "máx 6 palabras", "descripcion": "1-3 oraciones", "tiempo": "3–5 semanas" }
  ]
}

REGLAS OBLIGATORIAS:

OBJETIVOS: 3 a 5 objetivos funcionales del sistema, tomados de la propuesta.

MÓDULOS (tabla Soluciones): un objeto por módulo funcional.
- "complejidad" debe ser uno de: Simple, Medio, Medio-alto, Complejo.
- "descripcion": 1-2 oraciones sobre qué permite hacer el módulo. PROHIBIDO citar IDs de HU (H001, HU-002...). PROHIBIDO adjetivos vacíos (robusto, escalable, innovador).
- "funcionalidades": lista de bullets concretos (máx 6 por módulo), cada uno máx 1 línea.

PERSONAL (tabla Personal): roles válidos del tarifario: "Arquitecto de Solución / PM", "Programador Senior (Full Stack / Front)", "Programador Semi-Senior", "Revisor de Calidad (QA)", "Programador Junior", "Consultor Especialista".
- NO incluir tarifas ni costo/hora en la descripción.
- Incluir siempre un rol de QA con cantidad > 0.

ACTIVIDADES (tabla Actividades): DEBES devolver EXACTAMENTE 9 objetos, en este orden fijo (uno por cada actividad):
1. Toma de requerimientos y diseño de Mockups
2. Diseño técnico
3. Desarrollo Backend
4. Desarrollo Frontend
5. Pruebas unitarias
6. Pruebas UAT
7. Despliegue
8. Capacitación
9. Documentación y entrega
- Cada objeto: "descripcion" (1 oración corta del QUÉ) y "semanas" (número, permite 0.5).
- NO incluyas horas ni precios: las horas se calculan como semanas × 40 en el sistema.
- Pruebas unitarias (índice 5) y Pruebas UAT (índice 6) DEBEN tener semanas > 0.
- Bandas de referencia: Toma de requerimientos 1 sem por cada 2 módulos (máx 4); Diseño técnico 0.5-1 sem (2 si hay 2+ integraciones); Desarrollo Backend 0.5-3 sem/módulo según complejidad; Frontend 0.5-2.5 sem/módulo; Pruebas unitarias ≈ 15-20% del desarrollo; UAT 1-3 sem; Despliegue 0.5-1 sem; Capacitación 0.5-1 sem; Documentación 0.5-1 sem.

REQUERIMIENTOS (tabla Requerimientos y tiempos): un objeto por requerimiento funcional crítico.
- "nombre": funcional corto, máx 6 palabras, SIN IDs de HU.
- "tiempo": rango en semanas, formato "N–M semanas".

Si la propuesta no trae algún dato, dedúcelo de forma profesional y coherente con el alcance. NUNCA dejes arrays vacíos. Conserva los datos reales que sí aparezcan (nombres, módulos, requerimientos).`;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asString(x)).filter(Boolean);
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return fallback;
}

function normComplejidad(v: unknown): Complejidad {
  const s = asString(v).toLowerCase();
  const found = COMPLEJIDADES.find((c) => c.toLowerCase() === s);
  if (found) return found;
  if (s.includes("alto") || s.includes("complej")) return "Complejo";
  if (s.includes("medio")) return "Medio";
  if (s.includes("simple") || s.includes("bajo")) return "Simple";
  return "Medio";
}

function normModules(v: unknown): CorporateModule[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      const nombre = asString(o.nombre);
      if (!nombre) return null;
      return {
        nombre,
        complejidad: normComplejidad(o.complejidad),
        descripcion: asString(o.descripcion, "Funcionalidad del sistema."),
        funcionalidades: asStringArray(o.funcionalidades).slice(0, 6),
      } as CorporateModule;
    })
    .filter((m): m is CorporateModule => m !== null);
}

function normPersonal(v: unknown): CorporatePersonal[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      const rol = asString(o.rol);
      if (!rol) return null;
      return {
        rol,
        cantidad: Math.max(1, Math.round(asNumber(o.cantidad, 1))),
        descripcion: asString(o.descripcion, ""),
      } as CorporatePersonal;
    })
    .filter((p): p is CorporatePersonal => p !== null);
}

/** Normaliza a EXACTAMENTE 9 actividades en el orden fijo. */
function normActivities(v: unknown): CorporateActivity[] {
  const arr = Array.isArray(v) ? v : [];
  const defaults = defaultActivities();
  return ACTIVITY_ORDER.map((_, i) => {
    const o = (arr[i] ?? {}) as Record<string, unknown>;
    const semanas = asNumber(o.semanas, defaults[i].semanas);
    return {
      descripcion: asString(o.descripcion, defaults[i].descripcion),
      semanas: semanas > 0 ? semanas : defaults[i].semanas,
    };
  });
}

function normRequirements(v: unknown): CorporateRequirement[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      const nombre = asString(o.nombre);
      if (!nombre) return null;
      return {
        nombre,
        descripcion: asString(o.descripcion, ""),
        tiempo: asString(o.tiempo, "1–2 semanas"),
      } as CorporateRequirement;
    })
    .filter((r): r is CorporateRequirement => r !== null);
}

function defaultActivities(): CorporateActivity[] {
  const descs = [
    "Levantamiento de requerimientos y diseño de mockups con el cliente.",
    "Definición de la arquitectura técnica y modelo de datos.",
    "Implementación de la lógica de negocio y servicios del backend.",
    "Construcción de las interfaces de usuario del sistema.",
    "Pruebas funcionales de los módulos desarrollados.",
    "Pruebas de aceptación de usuario en pre-producción.",
    "Despliegue del aplicativo en el ambiente del cliente.",
    "Capacitación al equipo del cliente sobre el sistema.",
    "Documentación técnica y entrega final del proyecto.",
  ];
  const semanas = [2, 1, 4, 3, 1, 1, 0.5, 0.5, 0.5];
  return descs.map((d, i) => ({ descripcion: d, semanas: semanas[i] }));
}

function defaultPersonal(): CorporatePersonal[] {
  return [
    { rol: "Arquitecto de Solución / PM", cantidad: 1, descripcion: "Gestión del proyecto y definición de la arquitectura de la solución." },
    { rol: "Programador Senior (Full Stack / Front)", cantidad: 1, descripcion: "Desarrollo del backend y de los módulos de mayor complejidad." },
    { rol: "Programador Semi-Senior", cantidad: 1, descripcion: "Desarrollo del frontend y módulos de complejidad media." },
    { rol: "Revisor de Calidad (QA)", cantidad: 1, descripcion: "Pruebas funcionales, UAT y documentación de hallazgos." },
  ];
}

function buildFallback(cover: CorporateCover, rawText: string): CorporateProposalContent {
  const objetivos = extractObjetivos(rawText);
  return {
    cover,
    scrumMaster: "Manticore Labs",
    qaResponsable: "Manticore Labs",
    objetivos: objetivos.length ? objetivos : ["Cubrir los requerimientos funcionales solicitados por el cliente."],
    modulos: [
      {
        nombre: cover.name.slice(0, 40) || "Módulo principal",
        complejidad: "Medio",
        descripcion: "Módulo central que cubre las funcionalidades solicitadas en la propuesta.",
        funcionalidades: ["Gestión de la información", "Reportería básica"],
      },
    ],
    personal: defaultPersonal(),
    actividades: defaultActivities(),
    requerimientos: [
      { nombre: "Funcionalidad principal", descripcion: "Implementación del alcance funcional descrito en la propuesta.", tiempo: "2–4 semanas" },
    ],
  };
}

function extractObjetivos(rawText: string): string[] {
  const lines = rawText.split("\n").map((l) => l.trim());
  const out: string[] = [];
  let capture = false;
  for (const line of lines) {
    if (/^#{1,3}\s*objetivos?/i.test(line) || /^objetivos?$/i.test(line)) {
      capture = true;
      continue;
    }
    if (capture) {
      if (/^#{1,3}\s/.test(line) || /^---/.test(line)) break;
      const m = line.match(/^[-*•]\s+(.*)/);
      if (m && m[1].trim()) out.push(m[1].trim());
      if (out.length >= 6) break;
    }
  }
  return out;
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

export async function buildCorporateContent(
  rawText: string,
  cover: CorporateCover
): Promise<CorporateProposalContent> {
  const fallback = buildFallback(cover, rawText);

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[deepseek-propuesta-pdf] DEEPSEEK_API_KEY no configurada. Se usa fallback.");
    return fallback;
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const content = rawText.slice(0, 32000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          {
            role: "user",
            content: `Propuesta a estructurar (nombre: "${cover.name}", código: ${cover.code}):\n\n${content}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[deepseek-propuesta-pdf] HTTP ${res.status}. Se usa fallback.`);
      return fallback;
    }

    const json = (await res.json()) as DeepSeekResponse;
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return fallback;

    const parsed = parseJson(text);
    if (!parsed) return fallback;

    const modulos = normModules(parsed.modulos);
    const personal = normPersonal(parsed.personal);
    const requerimientos = normRequirements(parsed.requerimientos);
    const objetivos = asStringArray(parsed.objetivos);

    return {
      cover,
      scrumMaster: asString(parsed.scrumMaster, "Manticore Labs"),
      qaResponsable: asString(parsed.qaResponsable, "Manticore Labs"),
      objetivos: objetivos.length ? objetivos : fallback.objetivos,
      modulos: modulos.length ? modulos : fallback.modulos,
      personal: personal.length ? personal : fallback.personal,
      actividades: normActivities(parsed.actividades),
      requerimientos: requerimientos.length ? requerimientos : fallback.requerimientos,
    };
  } catch (err) {
    console.warn("[deepseek-propuesta-pdf] Error:", err);
    return fallback;
  }
}
