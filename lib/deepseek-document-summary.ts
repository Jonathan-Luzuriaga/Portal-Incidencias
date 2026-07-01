import { getProjectContext } from "./project-profiles";

const SYSTEM_PROMPT = `Eres un PM técnico. Recibes el texto de un reporte de incidencias de un cliente.

Devuelve ÚNICAMENTE JSON válido:
{
  "summary": "2-3 oraciones en español explicando de qué trata el reporte y cuántas incidencias contiene"
}

Reglas:
- Máximo 350 caracteres.
- Sin emojis.
- No inventes incidencias que no estén en el texto.
- Menciona el proyecto o módulo si aparece en el documento.`;

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function buildFallbackSummary(incidentCount: number, fileName?: string): string {
  const source = fileName ? ` del archivo "${fileName}"` : "";
  return `Reporte${source} con ${incidentCount} incidencia${incidentCount === 1 ? "" : "s"} detectada${incidentCount === 1 ? "" : "s"} para revisión y asignación al equipo.`;
}

function parseSummaryJson(raw: string): string | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { summary?: string };
    const summary = String(parsed.summary ?? "").trim();
    return summary || null;
  } catch {
    return null;
  }
}

/** Resumen corto con IA para el ticket padre de un documento. */
export async function generateDocumentTicketSummary(
  documentText: string,
  incidentCount: number,
  clientProject: string,
  fileName?: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return buildFallbackSummary(incidentCount, fileName);
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const projectContext = getProjectContext(clientProject);

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
            content: `Proyecto: ${projectContext}\nProyecto Cliente: ${clientProject}\nIncidencias detectadas: ${incidentCount}\nArchivo: ${fileName ?? "(sin nombre)"}\n\nTexto del documento:\n\n${documentText.slice(0, 12000)}`,
          },
        ],
      }),
    });

    if (!res.ok) return buildFallbackSummary(incidentCount, fileName);

    const json = (await res.json()) as DeepSeekResponse;
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return buildFallbackSummary(incidentCount, fileName);

    return parseSummaryJson(content) ?? buildFallbackSummary(incidentCount, fileName);
  } catch {
    return buildFallbackSummary(incidentCount, fileName);
  }
}
