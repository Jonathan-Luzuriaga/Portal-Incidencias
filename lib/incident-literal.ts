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
