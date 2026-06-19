import {
  TEAM_CATEGORY_OPTIONS,
  TEAM_CLIENT_PROJECT_OPTIONS,
  TEAM_TAG_SUGGESTIONS,
  resolveTeamClientProject,
} from "./team-profiles";
import type {
  FormattedTeamTask,
  TeamClient,
  TeamPriority,
  TeamTicketType,
} from "./team-types";
import { TEAM_CLIENTS, TEAM_PRIORITIES, TEAM_TICKET_TYPES } from "./team-types";

const SYSTEM_PROMPT = `Eres un asistente de gestión de proyectos en Manticore Labs. Recibes una descripción en bruto (notas, mensaje de Slack, idea suelta, bug informal) y la transformas en una tarea lista para Notion.

Devuelve ÚNICAMENTE un JSON válido (sin markdown envolvente) con esta estructura exacta:
{
  "title": "título claro y accionable (máx. 120 caracteres)",
  "shortDescription": "resumen técnico para la columna Descripción (máx. 200 caracteres)",
  "bodyMarkdown": "cuerpo en markdown con las secciones indicadas",
  "ticketType": "Tarea | Bug | Épica",
  "priority": "Alta | Media | Baja",
  "category": "una de las categorías permitidas",
  "tags": ["etiqueta1", "etiqueta2"],
  "client": "Manticore Labs | Bago | Plasticaucho",
  "clientProject": "valor exacto de Proyecto Cliente",
  "hours": null o número estimado de horas
}

Reglas para bodyMarkdown según ticketType:

Si ticketType es "Bug", usa estas secciones (## con emoji):
## 📍 Contexto
## 🔍 Detalle técnico
## 👣 Pasos para reproducir
## ✅ Criterio de cierre

Si ticketType es "Tarea" o "Épica", usa:
## 📍 Contexto
## 🎯 Objetivo
## 📐 Alcance
## ✅ Criterios de aceptación

Reglas generales:
- Corrige ortografía; no inventes requisitos que no estén en el texto.
- Si falta información, indícalo brevemente en la sección correspondiente.
- tags: incluye siempre "tareas"; añade "bugs" si es Bug; infiere etiquetas técnicas (Frontend, Backend, qa, notion, cursor, zonales, sgc, etc.) según el contenido.
- clientProject: elige el valor exacto más coherente con el texto.
- priority: Alta solo si bloquea producción o es crítico; Media por defecto en tareas normales.
- hours: estima solo si el texto da pistas de esfuerzo; si no, null.`;

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export interface TeamFormatHints {
  clientProject?: string;
  client?: TeamClient;
}

function allowedValuesPrompt(): string {
  return [
    `ticketType permitidos: ${TEAM_TICKET_TYPES.join(", ")}`,
    `priority permitidos: ${TEAM_PRIORITIES.join(", ")}`,
    `category permitidos: ${TEAM_CATEGORY_OPTIONS.join(", ")}`,
    `client permitidos: ${TEAM_CLIENTS.join(", ")}`,
    `clientProject permitidos: ${TEAM_CLIENT_PROJECT_OPTIONS.map((o) => o.value).join(", ")}`,
    `tags sugeridos (usa solo los que apliquen): ${TEAM_TAG_SUGGESTIONS.join(", ")}`,
  ].join("\n");
}

function firstLine(text: string): string {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean);
  return line ?? "Nueva tarea";
}

function buildFallback(raw: string, hints: TeamFormatHints): FormattedTeamTask {
  const title = firstLine(raw).slice(0, 120);
  const clientProject = resolveTeamClientProject(hints.clientProject);
  const lower = raw.toLowerCase();
  const isBug = /\bbug\b|\berror\b|\bfalla\b|\bincidencia\b/.test(lower);

  return {
    title,
    shortDescription: raw.replace(/\s+/g, " ").trim().slice(0, 200),
    bodyMarkdown: isBug
      ? `## 📍 Contexto\n${raw}\n\n## 🔍 Detalle técnico\n(Por completar)\n\n## 👣 Pasos para reproducir\n1. \n\n## ✅ Criterio de cierre\nResuelto si: el comportamiento coincide con lo esperado.`
      : `## 📍 Contexto\n${raw}\n\n## 🎯 Objetivo\n(Por completar)\n\n## 📐 Alcance\n(Por completar)\n\n## ✅ Criterios de aceptación\n- `,
    ticketType: isBug ? "Bug" : "Tarea",
    priority: "Media",
    category: isBug ? "BUG" : "Workflows",
    tags: isBug ? ["tareas", "bugs"] : ["tareas"],
    client: hints.client ?? "Manticore Labs",
    clientProject,
    hours: null,
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
      if (typeof tag === "string" && tag.trim()) {
        const normalized = tag.trim();
        if (allowed.has(normalized)) result.add(normalized);
      }
    }
  }

  if (ticketType === "Bug") result.add("bugs");

  return [...result];
}

function parseDeepSeekJson(raw: string): Partial<FormattedTeamTask> | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as Partial<FormattedTeamTask>;
  } catch {
    return null;
  }
}

function sanitizeFormatted(
  parsed: Partial<FormattedTeamTask>,
  fallback: FormattedTeamTask
): FormattedTeamTask {
  const ticketType = pickEnum(parsed.ticketType, TEAM_TICKET_TYPES, fallback.ticketType);
  const clientProjectRaw = typeof parsed.clientProject === "string" ? parsed.clientProject : fallback.clientProject;

  return {
    title: (parsed.title ?? fallback.title).slice(0, 120),
    shortDescription: (parsed.shortDescription ?? fallback.shortDescription).slice(0, 200),
    bodyMarkdown: parsed.bodyMarkdown ?? fallback.bodyMarkdown,
    ticketType,
    priority: pickEnum(parsed.priority, TEAM_PRIORITIES, fallback.priority),
    category: pickEnum(
      parsed.category,
      TEAM_CATEGORY_OPTIONS,
      fallback.category
    ),
    tags: sanitizeTags(parsed.tags, ticketType),
    client: pickEnum(parsed.client, TEAM_CLIENTS, fallback.client),
    clientProject: resolveTeamClientProject(clientProjectRaw),
    hours:
      typeof parsed.hours === "number" && parsed.hours > 0 ? parsed.hours : null,
  };
}

/**
 * Transforma texto en bruto en una tarea estructurada para Notion.
 * Si DeepSeek falla o no hay API key, usa plantilla mínima (fallback).
 */
export async function formatTeamTaskFromRaw(
  rawDescription: string,
  hints: TeamFormatHints = {}
): Promise<FormattedTeamTask> {
  const raw = rawDescription.trim();
  const fallback = buildFallback(raw, hints);

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
    hints.clientProject ? `Pista proyecto cliente: ${hints.clientProject}` : "",
    hints.client ? `Pista cliente: ${hints.client}` : "",
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
    if (!parsed?.title || !parsed.bodyMarkdown) {
      console.warn("[deepseek-team] JSON inválido. Se usa plantilla fallback.");
      return fallback;
    }

    return sanitizeFormatted(parsed, fallback);
  } catch (err) {
    console.warn("[deepseek-team] Error:", err);
    return fallback;
  }
}
