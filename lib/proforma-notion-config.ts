import { defaultPmAssigneeIdsCsv } from "./propuesta-defaults";

/** Configuración de tareas Notion creadas al publicar una proforma PDF. */

export interface ProformaNotionConfig {
  /** Etiqueta o UUID de la relation Proyecto (debe ser Proformas). */
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
    // Columna Proyecto = "Proformas" (UUID vía NOTION_PROFORMA_PROJECT_RELATION_ID o mapa).
    projectRelationId:
      process.env.NOTION_PROFORMA_PROJECT_RELATION_ID?.trim() ||
      process.env.NOTION_PROFORMAS_PROJECT_RELATION_ID?.trim() ||
      "Proformas",
    responsableIds: responsablesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    estado: process.env.NOTION_PROFORMA_STATUS ?? "Sin empezar",
    categoria: (process.env.NOTION_PROFORMA_CATEGORY ?? "Proformas")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    etiquetas: (process.env.NOTION_PROFORMA_TAGS ?? "Proformas")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    prioridadDefault: process.env.NOTION_PROFORMA_PRIORITY ?? "Media",
    // Columna Tipo = Proforma
    ticketType: process.env.NOTION_PROFORMA_TICKET_TYPE ?? "Proforma",
    clientDefault: process.env.NOTION_PROFORMA_CLIENT ?? process.env.NOTION_DEFAULT_CLIENT ?? "Bago",
  };
}

/** URL pública de una página Notion a partir de su id. */
export function notionPageUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
}
