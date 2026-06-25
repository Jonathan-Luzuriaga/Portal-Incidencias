import {
  TEAM_CATEGORY_OPTIONS,
  TEAM_TAG_SUGGESTIONS,
  resolveTeamClientProject,
} from "./team-profiles";
import type {
  FormattedSubtask,
  FormattedTeamTask,
  TeamClient,
  TeamEnvironment,
  TeamPriority,
  TeamScope,
  TeamTicketType,
} from "./team-types";
import { TEAM_CLIENTS, TEAM_PRIORITIES, TEAM_TICKET_TYPES } from "./team-types";

const SYSTEM_PROMPT = `Eres un asistente de gestión de proyectos en Manticore Labs. Recibes una descripción en bruto y la transformas en una tarea lista para Notion.

Devuelve ÚNICAMENTE un JSON válido con esta estructura:
{
  "title": "título claro y accionable (máx. 120 caracteres)",
  "shortDescription": "resumen para columna Descripción (máx. 200 caracteres)",
  "bodyMarkdown": "cuerpo en markdown con secciones",
  "priority": "Alta | Media | Baja",
  "category": "una categoría permitida",
  "tags": ["etiqueta1", "etiqueta2"],
  "hours": null o número,
  "subtasks": [{ "title": "...", "shortDescription": "...", "bodyMarkdown": "..." }]
}

NO incluyas ticketType, client ni clientProject en el JSON: el PM ya los eligió.

bodyMarkdown según el tipo indicado por el PM:

**Bug (QA — mantener este formato exacto):**
## Contexto
## Detalle técnico
## Pasos para reproducir
## Criterio de cierre
subtasks: []

**Tarea (simple — estilo PM conciso, sin sobrecargar):**
Ajusta el nivel de detalle al contexto:
- Idea breve (1-2 líneas): Contexto + Objetivo + Criterio de cierre (3 secciones cortas).
- Idea media: añade Alcance breve y 2-4 criterios de aceptación.
- Idea compleja: Contexto, Objetivo, Alcance, Criterios de aceptación, Notas técnicas (solo si aplica).
Usa ## para secciones. Sin emojis. Texto directo y completo pero no redundante.
subtasks: [] SIEMPRE (las tareas no llevan subtareas).

**Épica (formato completo):**
## Contexto
## Objetivo
## Alcance
## Criterios de aceptación
## Entregables
subtasks: 2-6 subtareas recomendadas. Cada subtarea debe incluir bodyMarkdown COMPLETO con:
## Contexto
## Objetivo
## Alcance
## Criterios de aceptación
(redactado según esa parte de la épica)

Reglas generales:
- Corrige ortografía; no inventes requisitos fuera del alcance descrito.
- tags: incluye "tareas"; añade "bugs" solo si el tipo es Bug; añade "qa" si el ambiente es QA.
- priority: Alta solo si es crítico o bloqueante.`;

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export interface TeamFormatHints {
  clientProject?: string;
  client?: TeamClient;
  ticketType?: TeamTicketType;
  projectLabel?: string;
  environment?: TeamEnvironment;
  scope?: TeamScope;
}

function allowedValuesPrompt(): string {
  return [
    `priority: ${TEAM_PRIORITIES.join(", ")}`,
    `category: ${TEAM_CATEGORY_OPTIONS.join(", ")}`,
    `tags sugeridos: ${TEAM_TAG_SUGGESTIONS.join(", ")}`,
  ].join("\n");
}

function firstLine(text: string): string {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean);
  return line ?? "Nueva tarea";
}

function sanitizeSubtasks(raw: unknown, ticketType: TeamTicketType): FormattedSubtask[] {
  if (ticketType !== "Épica" || !Array.isArray(raw)) return [];
  const result: FormattedSubtask[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const title = String((item as FormattedSubtask).title ?? "").trim();
    if (!title) continue;
    const shortDescription = String((item as FormattedSubtask).shortDescription ?? title).slice(0, 200);
    const bodyMarkdown = String((item as FormattedSubtask).bodyMarkdown ?? "").trim();
    result.push({
      title: title.slice(0, 120),
      shortDescription,
      ...(bodyMarkdown ? { bodyMarkdown } : {}),
    });
    if (result.length >= 8) break;
  }
  return result;
}

function buildFallbackBody(raw: string, ticketType: TeamTicketType): string {
  const trimmed = raw.trim();
  if (ticketType === "Bug") {
    return `## Contexto\n${trimmed}\n\n## Detalle técnico\n(Por completar)\n\n## Pasos para reproducir\n1. \n\n## Criterio de cierre\nResuelto si: el comportamiento coincide con lo esperado.`;
  }
  if (ticketType === "Épica") {
    return `## Contexto\n${trimmed}\n\n## Objetivo\n(Por completar)\n\n## Alcance\n(Por completar)\n\n## Criterios de aceptación\n- \n\n## Entregables\n- `;
  }
  const isBrief = trimmed.length < 120 && !trimmed.includes("\n");
  if (isBrief) {
    return `## Contexto\n${trimmed}\n\n## Objetivo\n(Por completar)\n\n## Criterio de cierre\n- `;
  }
  return `## Contexto\n${trimmed}\n\n## Objetivo\n(Por completar)\n\n## Alcance\n(Por completar)\n\n## Criterios de aceptación\n- `;
}

function buildFallback(raw: string, hints: TeamFormatHints): FormattedTeamTask {
  const title = firstLine(raw).slice(0, 120);
  const ticketType = hints.ticketType ?? "Tarea";
  const meta = hints.clientProject
    ? { clientProject: resolveTeamClientProject(hints.clientProject), client: hints.client ?? "Manticore Labs" as TeamClient }
    : { clientProject: "[ML][Gestion]", client: "Manticore Labs" as TeamClient };

  const isBug = ticketType === "Bug";
  const scopeCategory =
    hints.scope === "Backend"
      ? "Backend"
      : hints.scope === "Frontend"
        ? "Frontend"
        : isBug
          ? "BUG"
          : "Workflows";

  const tags = isBug ? ["tareas", "bugs"] : ["tareas"];
  if (hints.environment === "QA") tags.push("qa");

  return {
    title,
    shortDescription: raw.replace(/\s+/g, " ").trim().slice(0, 200),
    bodyMarkdown: buildFallbackBody(raw, ticketType),
    ticketType,
    priority: "Media",
    category: isBug ? "BUG" : scopeCategory,
    tags,
    client: meta.client,
    clientProject: meta.clientProject,
    hours: null,
    subtasks:
      ticketType === "Épica"
        ? [{ title: "Definir alcance", shortDescription: "Detallar entregables de la épica" }]
        : [],
  };
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

function sanitizeTags(tags: unknown, ticketType: TeamTicketType, environment?: TeamEnvironment): string[] {
  const result = new Set<string>(["tareas"]);

  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag === "string") {
        const trimmed = tag.trim().slice(0, 100);
        if (trimmed) result.add(trimmed);
      }
    }
  }

  if (ticketType === "Bug") result.add("bugs");
  if (environment === "QA") result.add("qa");

  return [...result];
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

function sanitizeFormatted(
  parsed: Record<string, unknown>,
  fallback: FormattedTeamTask,
  hints: TeamFormatHints
): FormattedTeamTask {
  const ticketType = hints.ticketType ?? fallback.ticketType;
  const meta = hints.clientProject
    ? {
        clientProject: resolveTeamClientProject(hints.clientProject),
        client: hints.client ?? fallback.client,
      }
    : { clientProject: fallback.clientProject, client: fallback.client };

  const subtasks = sanitizeSubtasks(parsed.subtasks, ticketType);

  return {
    title: String(parsed.title ?? fallback.title).slice(0, 120),
    shortDescription: String(parsed.shortDescription ?? fallback.shortDescription).slice(0, 200),
    bodyMarkdown: String(parsed.bodyMarkdown ?? fallback.bodyMarkdown),
    ticketType,
    priority: pickEnum(parsed.priority as TeamPriority, TEAM_PRIORITIES, fallback.priority),
    category: pickEnum(parsed.category as string, TEAM_CATEGORY_OPTIONS, fallback.category),
    tags: sanitizeTags(parsed.tags, ticketType, hints.environment),
    client: meta.client,
    clientProject: meta.clientProject,
    hours: typeof parsed.hours === "number" && parsed.hours > 0 ? parsed.hours : null,
    subtasks:
      ticketType === "Épica"
        ? subtasks.length > 0
          ? subtasks
          : fallback.subtasks
        : [],
  };
}

/**
 * Transforma texto en bruto en una tarea estructurada para Notion.
 * El tipo de ticket y proyecto los define el PM (hints), no la IA.
 */
export async function formatTeamTaskFromRaw(
  rawDescription: string,
  hints: TeamFormatHints = {}
): Promise<FormattedTeamTask> {
  const raw = rawDescription.trim();
  const projectMeta = hints.clientProject
    ? { clientProject: hints.clientProject, client: hints.client }
    : undefined;
  const fallback = buildFallback(raw, {
    ...hints,
    clientProject: projectMeta?.clientProject ?? hints.clientProject,
    client: projectMeta?.client ?? hints.client,
  });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[deepseek-team] DEEPSEEK_API_KEY no configurada. Se usa plantilla fallback.");
    return fallback;
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  const userContent = [
    "Valores permitidos:",
    allowedValuesPrompt(),
    hints.ticketType ? `Tipo elegido por PM: ${hints.ticketType}` : "",
    hints.projectLabel ? `Proyecto: ${hints.projectLabel}` : "",
    hints.clientProject ? `Proyecto Cliente: ${hints.clientProject}` : "",
    hints.environment ? `Ambiente elegido por PM: ${hints.environment}` : "",
    hints.scope ? `Área técnica elegida por PM: ${hints.scope}` : "",
    "",
    "Descripción en bruto:",
    raw,
  ]
    .filter(Boolean)
    .join("\n");

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
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[deepseek-team] HTTP ${res.status}. Se usa plantilla fallback.`);
      return fallback;
    }

    const json = (await res.json()) as DeepSeekResponse;
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return fallback;

    const parsed = parseDeepSeekJson(content);
    if (!parsed?.title && !parsed?.bodyMarkdown) {
      console.warn("[deepseek-team] JSON inválido. Se usa plantilla fallback.");
      return fallback;
    }

    return sanitizeFormatted(parsed, fallback, hints);
  } catch (err) {
    console.warn("[deepseek-team] Error:", err);
    return fallback;
  }
}
