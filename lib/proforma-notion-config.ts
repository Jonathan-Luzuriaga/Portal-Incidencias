import { defaultPmAssigneeIdsCsv } from "./propuesta-defaults";

/** Configuración de tareas Notion creadas al publicar una proforma PDF. */

export interface ProformaNotionConfig {
  projectRelationId: string;
  responsableIds: string[];
  estado: string;
  categoria: string[];
  etiquetas: string[];
  prioridadDefault: string;
  ticketType: string;
  clientDefault: string;
}

export function getProformaNotionConfig(): ProformaNotionConfig {
  const responsablesRaw =
    process.env.NOTION_PROFORMA_RESPONSABLE_IDS ??
    process.env.NOTION_PROPUESTA_RESPONSABLE_IDS ??
    process.env.NOTION_BAGO_ASSIGNEE_IDS ??
    defaultPmAssigneeIdsCsv();

  return {
    // Preferir proyecto Proforma; si no hay env, reutilizar el de propuestas.
    projectRelationId:
      process.env.NOTION_PROFORMA_PROJECT_RELATION_ID?.trim() ||
      process.env.NOTION_PROPUESTA_PROJECT_RELATION_ID?.trim() ||
      "3424f339-cf21-80c9-b6d9-e02c4f8c3efa",
    responsableIds: responsablesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    estado: process.env.NOTION_PROFORMA_STATUS ?? "Sin empezar",
    categoria: (process.env.NOTION_PROFORMA_CATEGORY ?? "Proforma")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    etiquetas: (process.env.NOTION_PROFORMA_TAGS ?? "Proforma")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    prioridadDefault: process.env.NOTION_PROFORMA_PRIORITY ?? "Media",
    ticketType: process.env.NOTION_PROFORMA_TICKET_TYPE ?? "Tarea",
    clientDefault: process.env.NOTION_PROFORMA_CLIENT ?? process.env.NOTION_DEFAULT_CLIENT ?? "Bago",
  };
}

/** URL pública de una página Notion a partir de su id. */
export function notionPageUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
}
