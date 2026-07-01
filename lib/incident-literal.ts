import { getNotionConfig } from "./notion-config";
import type { IncidentFormData, Priority } from "./types";

export interface LiteralIncidentOptions {
  /** Nombre del archivo PDF/DOCX de origen, si aplica. */
  documentFileName?: string;
  /** Texto crudo de la sección del documento para esta incidencia. */
  documentSectionText?: string;
}

/** Título del ticket padre en Notion. */
export function buildTicketTitle(form: IncidentFormData): string {
  const title = form.title.trim();
  return title.startsWith("[Ticket]") ? title : `[Ticket] ${title}`;
}

/** Mapea prioridad del formulario al select de Notion. */
export function mapFormPriorityToNotion(priority: Priority): string {
  return getNotionConfig().priorityMap[priority];
}

function formatFormFields(form: IncidentFormData): string {
  return [
    `**Proyecto Cliente:** ${form.clientProject}`,
    `**Título:** ${form.title}`,
    `**Prioridad:** ${form.priority}`,
    `**Justificación / descripción:** ${form.justification}`,
    `**Ambiente:** ${form.environment}`,
    `**Fecha/Hora (TZ):** ${form.dateTime}`,
    `**Usuario / Rol:** ${form.userRole}`,
    `**Módulo / URL:** ${form.moduleUrl}`,
    `**Navegador / Dispositivo:** ${form.browserDevice}`,
    `**ID / Registro afectado:** ${form.affectedRecordId}`,
    `**Resumen:** ${form.summary}`,
    `**Resultado actual (pasos):** ${form.actualResult}`,
    `**Resultado esperado:** ${form.expectedResult}`,
  ].join("\n");
}

/** Título del ticket padre a partir del nombre del archivo. */
export function buildDocumentTicketTitle(fileName: string): string {
  const base = fileName.replace(/\.(pdf|docx)$/i, "").trim() || "Reporte de incidencias";
  return base.startsWith("[Ticket]") ? base : `[Ticket] ${base}`;
}

/** Cuerpo del ticket padre para un documento completo (resumen IA + transcripción literal). */
export function buildLiteralDocumentParentBody(
  documentText: string,
  aiSummary: string,
  fileName?: string
): string {
  const lines: string[] = [
    "## Resumen",
    "",
    aiSummary.trim(),
    "",
    "## Transcripción del documento",
    "",
  ];

  if (fileName) {
    lines.push(`**Archivo origen:** ${fileName}`, "");
  }

  lines.push(documentText.trim());
  return lines.join("\n").trimEnd();
}

/** Cuerpo literal de una subtarea = una incidencia del documento. */
export function buildLiteralIncidentSubtaskBody(
  form: IncidentFormData,
  index: number
): string {
  return [
    `## Incidencia ${String(index + 1).padStart(3, "0")}`,
    "",
    formatFormFields(form),
  ].join("\n");
}

/** Prioridad más alta entre varias incidencias. */
export function highestIncidentPriority(incidents: IncidentFormData[]): IncidentFormData["priority"] {
  if (incidents.some((i) => i.priority === "Alto")) return "Alto";
  if (incidents.some((i) => i.priority === "Medio")) return "Medio";
  return "Bajo";
}

/**
 * Cuerpo literal del ticket padre: valores tal cual, sin reformateo IA.
 * Las evidencias y el documento se adjuntan como bloques Notion aparte.
 */
export function buildLiteralIncidentBody(
  form: IncidentFormData,
  options?: LiteralIncidentOptions
): string {
  const lines: string[] = ["## Transcripción del reporte", ""];

  if (options?.documentFileName) {
    lines.push(`**Archivo origen:** ${options.documentFileName}`, "");
  }

  if (options?.documentSectionText?.trim()) {
    lines.push("### Texto del documento", "", options.documentSectionText.trim(), "");
    lines.push("### Campos estructurados", "", formatFormFields(form));
  } else {
    lines.push(formatFormFields(form));
  }

  return lines.join("\n").trimEnd();
}
