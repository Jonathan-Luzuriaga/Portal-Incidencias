import {
  TEAM_CATEGORY_OPTIONS,
  TEAM_CLIENT_PROJECT_OPTIONS,
  TEAM_TAG_SUGGESTIONS,
  resolveTeamClientProject,
} from "./team-profiles";
import type {
  FormattedSubtask,
  FormattedTeamTask,
  TeamClient,
  TeamPriority,
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
  "subtasks": [{ "title": "...", "shortDescription": "..." }]
}

NO incluyas ticketType, client ni clientProject en el JSON: el PM ya los eligió.

bodyMarkdown según tipo indicado por el PM:
- Bug: ## 📍 Contexto, ## 🔍 Detalle técnico, ## 👣 Pasos para reproducir, ## ✅ Criterio de cierre
- Tarea/Épica: ## 📍 Contexto, ## 🎯 Objetivo, ## 📐 Alcance, ## ✅ Criterios de aceptación

subtasks:
- Si el tipo es Épica o la idea tiene pasos claramente separables, sugiere 2-6 subtareas concretas.
- Si es Bug o idea simple, devuelve subtasks: [].

Reglas:
- Corrige ortografía; no inventes requisitos.
- tags: incluye "tareas"; añade "bugs" solo si el tipo es Bug.
- priority: Alta solo si es crítico o bloqueante.`;

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export interface TeamFormatHints {
  clientProject?: string;
  client?: TeamClient;
  ticketType?: TeamTicketType;
  projectLabel?: string;
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

function sanitizeSubtasks(raw: unknown): FormattedSubtask[] {
  if (!Array.isArray(raw)) return [];
  const result: FormattedSubtask[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const title = String((item as FormattedSubtask).title ?? "").trim();
    if (!title) continue;
    result.push({
      title: title.slice(0, 120),
      shortDescription: String((item as FormattedSubtask).shortDescription ?? title).slice(0, 200),
    });
    if (result.length >= 8) break;
  }
  return result;
}

function buildFallback(raw: string, hints: TeamFormatHints): FormattedTeamTask {
  const title = firstLine(raw).slice(0, 120);
  const ticketType = hints.ticketType ?? "Tarea";
  const meta = hints.clientProject
    ? { clientProject: resolveTeamClientProject(hints.clientProject), client: hints.client ?? "Manticore Labs" as TeamClient }
    : { clientProject: "[ML][Gestion]", client: "Manticore Labs" as TeamClient };

  const isBug = ticketType === "Bug";

  return {
    title,
    shortDescription: raw.replace(/\s+/g, " ").trim().slice(0, 200),
    bodyMarkdown: isBug
      ? `## 📍 Contexto\n${raw}\n\n## 🔍 Detalle técnico\n(Por completar)\n\n## 👣 Pasos para reproducir\n1. \n\n## ✅ Criterio de cierre\nResuelto si: el comportamiento coincide con lo esperado.`
      : `## 📍 Contexto\n${raw}\n\n## 🎯 Objetivo\n(Por completar)\n\n## 📐 Alcance\n(Por completar)\n\n## ✅ Criterios de aceptación\n- `,
    ticketType,
    priority: "Media",
    category: isBug ? "BUG" : "Workflows",
    tags: isBug ? ["tareas", "bugs"] : ["tareas"],
    client: meta.client,
    clientProject: meta.clientProject,
    hours: null,
    subtasks: ticketType === "Épica" ? [{ title: "Definir alcance", shortDescription: "Detallar entregables de la épica" }] : [],
  };
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

function sanitizeTags(tags: unknown, ticketType: TeamTicketType): string[] {
  const allowed = new Set<string>(TEAM_TAG_SUGGESTIONS);
  const result = new Set<string>(["tareas"]);

  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag === "string" && tag.trim() && allowed.has(tag.trim())) {
        result.add(tag.trim());
      }
    }
  }

  if (ticketType === "Bug") result.add("bugs");

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

  return {
    title: String(parsed.title ?? fallback.title).slice(0, 120),
    shortDescription: String(parsed.shortDescription ?? fallback.shortDescription).slice(0, 200),
    bodyMarkdown: String(parsed.bodyMarkdown ?? fallback.bodyMarkdown),
    ticketType,
    priority: pickEnum(parsed.priority as TeamPriority, TEAM_PRIORITIES, fallback.priority),
    category: pickEnum(parsed.category as string, TEAM_CATEGORY_OPTIONS, fallback.category),
    tags: sanitizeTags(parsed.tags, ticketType),
    client: meta.client,
    clientProject: meta.clientProject,
    hours: typeof parsed.hours === "number" && parsed.hours > 0 ? parsed.hours : null,
    subtasks: sanitizeSubtasks(parsed.subtasks).length > 0
      ? sanitizeSubtasks(parsed.subtasks)
      : fallback.subtasks,
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
    hints.ticketType ? `Tipo elegido por PM (usar para plantilla bodyMarkdown): ${hints.ticketType}` : "",
    hints.projectLabel ? `Proyecto: ${hints.projectLabel}` : "",
    hints.clientProject ? `Proyecto Cliente: ${hints.clientProject}` : "",
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
