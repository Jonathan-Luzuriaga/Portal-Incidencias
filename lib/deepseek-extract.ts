import type { IncidentFormData, Priority, Environment } from "./types";
import { ENVIRONMENTS, PRIORITIES } from "./types";
import { nowInGuayaquil } from "./dates";
import { ServiceError } from "./types";
import { inferClientProjectFromText, resolveClientProject } from "./project-profiles";

const EXTRACT_PROMPT = `Eres un analista QA. Recibes el texto extraído de un reporte de incidencias (PDF o Word) en formato ZONALES o similar.

Devuelve ÚNICAMENTE JSON válido con esta estructura:
{
  "incidents": [
    {
      "projectHint": "zonales | sgc | rega | otro",
      "title": "string",
      "priority": "Alto | Medio | Bajo",
      "justification": "string",
      "environment": "Desarrollo | LATEST | QA | Producción",
      "dateTime": "DD/MM/YYYY o DD/MM/YYYY HH:mm si existe",
      "userRole": "string",
      "moduleUrl": "string",
      "browserDevice": "string",
      "affectedRecordId": "string",
      "summary": "string",
      "actualResult": "string con pasos numerados",
      "expectedResult": "string"
    }
  ]
}

Reglas:
- Si hay varias incidencias (INCIDENCIA 001, 002…), devuelve una entrada por cada una.
- Mapea prioridad: Bajo→Bajo, Medio→Medio, Alto→Alto, Crítica→Alto, Baja→Bajo, Media→Medio, Alta→Alto.
- Si el título menciona ZONALES → projectHint "zonales". Si menciona SGC → "sgc".
- No inventes datos; usa cadena vacía solo si realmente falta en el documento.
- actualResult debe incluir los pasos de reproducción numerados cuando existan.`;

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface RawIncident {
  projectHint?: string;
  title?: string;
  priority?: string;
  justification?: string;
  environment?: string;
  dateTime?: string;
  userRole?: string;
  moduleUrl?: string;
  browserDevice?: string;
  affectedRecordId?: string;
  summary?: string;
  actualResult?: string;
  expectedResult?: string;
}

function mapPriority(raw: string | undefined): Priority {
  const v = (raw ?? "Medio").toLowerCase();
  if (v.includes("alt") || v.includes("crít") || v.includes("crit")) return "Alto";
  if (v.includes("baj")) return "Bajo";
  return "Medio";
}

function mapEnvironment(raw: string | undefined): Environment {
  const v = (raw ?? "LATEST").toLowerCase();
  if (v.includes("prod")) return "Producción";
  if (v.includes("desarrollo") || v.includes("dev")) return "Desarrollo";
  if (v.includes("qa")) return "QA";
  return "LATEST";
}

function normalizeIncident(raw: RawIncident, defaultClientProject: string): IncidentFormData | null {
  const title = (raw.title ?? "").trim();
  if (!title) return null;

  const combined = `${raw.projectHint ?? ""} ${title}`;
  const clientProject = inferClientProjectFromText(combined, defaultClientProject);

  return {
    clientProject,
    title,
    priority: mapPriority(raw.priority),
    justification: (raw.justification ?? raw.summary ?? title).trim(),
    environment: mapEnvironment(raw.environment),
    dateTime: (raw.dateTime ?? "").trim() || nowInGuayaquil(),
    userRole: (raw.userRole ?? "QA").trim(),
    moduleUrl: (raw.moduleUrl ?? "").trim() || "No especificado",
    browserDevice: (raw.browserDevice ?? "Chrome / Laptop").trim(),
    affectedRecordId: (raw.affectedRecordId ?? title).trim(),
    summary: (raw.summary ?? title).trim(),
    actualResult: (raw.actualResult ?? raw.justification ?? "").trim() || "Ver documento adjunto.",
    expectedResult: (raw.expectedResult ?? "Comportamiento correcto según versión anterior.").trim(),
  };
}

function parseExtractJson(raw: string): RawIncident[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]) as { incidents?: RawIncident[] };
  return Array.isArray(parsed.incidents) ? parsed.incidents : [];
}

/** Usa DeepSeek para extraer una o más incidencias del texto de un documento. */
export async function extractIncidentsFromDocument(
  documentText: string,
  defaultClientProject: string
): Promise<IncidentFormData[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new ServiceError("Falta DEEPSEEK_API_KEY para procesar documentos.", 500);
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const resolvedDefault = resolveClientProject(defaultClientProject);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACT_PROMPT },
        {
          role: "user",
          content: `Proyecto Cliente por defecto: ${resolvedDefault}\n\n--- DOCUMENTO ---\n${documentText.slice(0, 120000)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new ServiceError(`DeepSeek no pudo leer el documento (HTTP ${res.status}).`, 502);
  }

  const json = (await res.json()) as DeepSeekResponse;
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new ServiceError("DeepSeek no devolvió incidencias del documento.", 502);
  }

  let rawList: RawIncident[];
  try {
    rawList = parseExtractJson(content);
  } catch {
    throw new ServiceError("DeepSeek devolvió un JSON inválido al leer el documento.", 502);
  }

  const incidents = rawList
    .map((r) => normalizeIncident(r, resolvedDefault))
    .filter((i): i is IncidentFormData => i !== null);

  if (incidents.length === 0) {
    throw new ServiceError("No se encontraron incidencias en el documento.", 400);
  }

  for (const inc of incidents) {
    if (!PRIORITIES.includes(inc.priority)) inc.priority = "Medio";
    if (!ENVIRONMENTS.includes(inc.environment)) inc.environment = "LATEST";
    inc.clientProject = resolveClientProject(inc.clientProject);
  }

  return incidents;
}
