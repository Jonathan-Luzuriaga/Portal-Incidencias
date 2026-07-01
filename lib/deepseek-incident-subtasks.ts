import { getProjectContext } from "./project-profiles";
import type { FormattedSubtask } from "./team-types";

const SYSTEM_PROMPT = `Eres un PM técnico en Manticore Labs. Recibes la transcripción literal de un reporte de incidencia de un cliente.

Tu trabajo es dividir el trabajo en subtareas accionables para que un PM las asigne al equipo.

Devuelve ÚNICAMENTE JSON válido:
{
  "subtasks": [
    {
      "title": "título claro y accionable (máx. 120 caracteres)",
      "shortDescription": "resumen para columna Descripción (máx. 200 caracteres)",
      "bodyMarkdown": "cuerpo completo en markdown"
    }
  ]
}

Reglas:
- Genera entre 2 y 6 subtareas según la complejidad del incidente.
- Cada bodyMarkdown debe incluir EXACTAMENTE estas secciones con ##:
  ## Contexto
  ## Objetivo
  ## Alcance
  ## Criterios de aceptación
- Sin emojis. Texto directo basado SOLO en el reporte; no inventes requisitos.
- Las subtareas deben ser independientes y asignables (investigación, fix, validación QA, etc.).`;

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function buildFallbackSubtask(): FormattedSubtask {
  return {
    title: "Revisar y clasificar incidencia",
    shortDescription: "Triage inicial del ticket de incidencia reportado por el cliente.",
    bodyMarkdown: `## Contexto
Ticket de incidencia reportado por el cliente. Requiere revisión del PM.

## Objetivo
Clasificar la incidencia, validar la información y definir el plan de acción.

## Alcance
- Revisar la transcripción del reporte y evidencias adjuntas.
- Confirmar prioridad y ambiente afectado.
- Definir responsable y siguientes pasos.

## Criterios de aceptación
- La incidencia está clasificada y asignada, o se solicita información adicional al cliente.`,
  };
}

function sanitizeSubtasks(raw: unknown): FormattedSubtask[] {
  if (!Array.isArray(raw)) return [];
  const result: FormattedSubtask[] = [];
  for (const item of raw.slice(0, 8)) {
    const title = String((item as FormattedSubtask).title ?? "").trim();
    if (!title) continue;
    const shortDescription = String((item as FormattedSubtask).shortDescription ?? title).slice(0, 200);
    const bodyMarkdown = String((item as FormattedSubtask).bodyMarkdown ?? "").trim();
    result.push({
      title,
      shortDescription,
      bodyMarkdown:
        bodyMarkdown ||
        `## Contexto\nSubtarea derivada del ticket de incidencia.\n\n## Objetivo\n${shortDescription}\n\n## Alcance\n(Por completar)\n\n## Criterios de aceptación\n- `,
    });
  }
  return result;
}

function parseSubtasksJson(raw: string): FormattedSubtask[] | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { subtasks?: unknown };
    const subtasks = sanitizeSubtasks(parsed.subtasks);
    return subtasks.length > 0 ? subtasks : null;
  } catch {
    return null;
  }
}

/**
 * Genera subtareas sugeridas a partir de la transcripción literal del ticket padre.
 */
export async function generateIncidentSubtasks(
  literalBody: string,
  clientProject: string
): Promise<FormattedSubtask[]> {
  const projectContext = getProjectContext(clientProject);
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.warn("[deepseek-incident-subtasks] DEEPSEEK_API_KEY no configurada. Subtarea fallback.");
    return [buildFallbackSubtask()];
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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Proyecto: ${projectContext}\nProyecto Cliente: ${clientProject}\n\nTranscripción del reporte:\n\n${literalBody}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[deepseek-incident-subtasks] HTTP ${res.status}. Subtarea fallback.`);
      return [buildFallbackSubtask()];
    }

    const json = (await res.json()) as DeepSeekResponse;
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return [buildFallbackSubtask()];

    const parsed = parseSubtasksJson(content);
    return parsed ?? [buildFallbackSubtask()];
  } catch (err) {
    console.warn("[deepseek-incident-subtasks] Error:", err);
    return [buildFallbackSubtask()];
  }
}
