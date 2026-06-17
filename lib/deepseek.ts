import type { IncidentFormData, FormattedIncident } from "./types";
import { getProjectContext } from "./project-profiles";

const SYSTEM_PROMPT = `Eres un QA técnico senior. Recibes un reporte de incidencia redactado por un cliente externo y debes transformarlo en una tarea de QA lista para Notion.

Debes devolver ÚNICAMENTE un JSON válido (sin markdown, sin explicaciones) con esta estructura exacta:
{
  "taskTitle": "[QA] Bug: {resumen corto del bug}",
  "shortDescription": "Una oración técnica clara del problema (máx. 200 caracteres)",
  "notionPriority": "Alta | Media | Baja",
  "bodyMarkdown": "cuerpo completo en markdown con las secciones indicadas abajo"
}

Reglas para taskTitle:
- Siempre empieza con "[QA] Bug: "
- Resume el problema en pocas palabras, incluyendo módulo o URL si es relevante.

Reglas para bodyMarkdown — usa EXACTAMENTE estas secciones con emojis como encabezados (##):

## 🎫 REPORTE DE INCIDENTE
{resumen del incidente en 1-2 líneas}

## 🚨 PRIORIDAD
{Alta | Media | Baja — coherente con notionPriority}

## ⚖ JUSTIFICACIÓN
{justificación clara: por qué importa, impacto al usuario, si bloquea o no}

## 📍 CONTEXTO Y ENTORNO
Proyecto: {nombre del proyecto}
Ambiente: {ambiente}
Fecha/Hora (TZ): {fecha/hora}
Usuario/Rol: {usuario/rol}
Módulo/URL: {módulo y url}
Navegador/Dispositivo: {navegador/dispositivo}

## 🔍 DETALLE TÉCNICO
Resumen: {resumen técnico}
Resultado Actual (Versión Latest): {qué ocurre actualmente}
Resultado Esperado: {comportamiento correcto}
ID / Registro afectado: {id o registro}

## 👣 REPRODUCCIÓN
Lista numerada de pasos claros para reproducir el bug (1. 2. 3. ...)

## ✅ CRITERIO DE CIERRE
Resuelto si: {condición concreta y verificable para dar por cerrado el bug}

Reglas generales:
- Corrige ortografía y gramática del texto original.
- No inventes datos técnicos que no estén en el reporte.
- Si falta información, indícalo brevemente en la sección correspondiente.
- notionPriority debe ser coherente con la prioridad del formulario (Alto→Alta, Medio→Media, Bajo→Baja).`;

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function buildFallback(form: IncidentFormData, notionPriority: string, projectContext: string): FormattedIncident {
  const taskTitle = `[QA] Bug: ${form.summary || form.title}`;

  const bodyMarkdown = `## 🎫 REPORTE DE INCIDENTE
${form.title}

## 🚨 PRIORIDAD
${notionPriority}

## ⚖ JUSTIFICACIÓN
${form.justification}

## 📍 CONTEXTO Y ENTORNO
Proyecto: ${projectContext}
Ambiente: ${form.environment}
Fecha/Hora (TZ): ${form.dateTime}
Usuario/Rol: ${form.userRole}
Módulo/URL: ${form.moduleUrl}
Navegador/Dispositivo: ${form.browserDevice}

## 🔍 DETALLE TÉCNICO
Resumen: ${form.summary}
Resultado Actual (Versión Latest): ${form.actualResult}
Resultado Esperado: ${form.expectedResult}
ID / Registro afectado: ${form.affectedRecordId}

## 👣 REPRODUCCIÓN
${form.actualResult}

## ✅ CRITERIO DE CIERRE
Resuelto si: El comportamiento observado coincide con el resultado esperado descrito arriba, verificado en ambiente ${form.environment}.`;

  return {
    taskTitle,
    shortDescription: form.summary || form.justification.slice(0, 200),
    notionPriority,
    bodyMarkdown,
  };
}

function formToPrompt(form: IncidentFormData, projectContext: string): string {
  return JSON.stringify(
    {
      titulo: form.title,
      prioridad: form.priority,
      justificacion: form.justification,
      ambiente: form.environment,
      fechaHora: form.dateTime,
      usuarioRol: form.userRole,
      moduloUrl: form.moduleUrl,
      navegadorDispositivo: form.browserDevice,
      idRegistroAfectado: form.affectedRecordId,
      resumen: form.summary,
      resultadoActual: form.actualResult,
      resultadoEsperado: form.expectedResult,
      proyectoContexto: projectContext,
    },
    null,
    2
  );
}

function parseDeepSeekJson(raw: string): FormattedIncident | null {
  try {
    // Extrae JSON aunque venga envuelto en ```json ... ```
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<FormattedIncident>;
    if (!parsed.taskTitle || !parsed.bodyMarkdown || !parsed.notionPriority) return null;
    return {
      taskTitle: parsed.taskTitle,
      shortDescription: parsed.shortDescription ?? parsed.taskTitle,
      notionPriority: parsed.notionPriority,
      bodyMarkdown: parsed.bodyMarkdown,
    };
  } catch {
    return null;
  }
}

/**
 * Usa DeepSeek para transformar el reporte del cliente en una tarea QA estructurada.
 * Si falla, construye un reporte con la plantilla estándar (fallback).
 */
export async function formatIncidentForNotion(form: IncidentFormData): Promise<FormattedIncident> {
  const projectContext = getProjectContext(form.clientProject);
  const notionPriority =
    form.priority === "Alto" ? "Alta" : form.priority === "Medio" ? "Media" : "Baja";

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[deepseek] DEEPSEEK_API_KEY no configurada. Se usa plantilla fallback.");
    return buildFallback(form, notionPriority, projectContext);
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
          { role: "user", content: formToPrompt(form, projectContext) },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[deepseek] HTTP ${res.status}. Se usa plantilla fallback.`);
      return buildFallback(form, notionPriority, projectContext);
    }

    const json = (await res.json()) as DeepSeekResponse;
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return buildFallback(form, notionPriority, projectContext);

    const parsed = parseDeepSeekJson(content);
    if (!parsed) {
      console.warn("[deepseek] JSON inválido. Se usa plantilla fallback.");
      return buildFallback(form, notionPriority, projectContext);
    }

    return parsed;
  } catch (err) {
    console.warn("[deepseek] Error:", err);
    return buildFallback(form, notionPriority, projectContext);
  }
}
