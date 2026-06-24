import { defaultPmAssigneeIdsCsv } from "./propuesta-defaults";

/** Configuración del flujo de Propuestas (/propuestas). */

export interface PropuestaConfig {
  projectRelationId: string;
  responsableIds: string[];
  estado: string;
  categoria: string[];
  etiquetas: string[];
  prioridadDefault: string;
}

export function getPropuestaConfig(): PropuestaConfig {
  const responsablesRaw =
    process.env.NOTION_PROPUESTA_RESPONSABLE_IDS ??
    process.env.NOTION_BAGO_ASSIGNEE_IDS ??
    defaultPmAssigneeIdsCsv();

  return {
    projectRelationId:
      process.env.NOTION_PROPUESTA_PROJECT_RELATION_ID ?? "3424f339-cf21-80c9-b6d9-e02c4f8c3efa",
    responsableIds: responsablesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    estado: process.env.NOTION_PROPUESTA_STATUS ?? "Por Revisar",
    categoria: (process.env.NOTION_PROPUESTA_CATEGORY ?? "Propuesta")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    etiquetas: (process.env.NOTION_PROPUESTA_TAGS ?? "Propuestas")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    prioridadDefault: process.env.NOTION_PROPUESTA_PRIORITY ?? "Media",
  };
}

/** Responsables PM por defecto (propuestas e incidencias Bago). */
export function getPmAssigneeIds(): string[] {
  return getPropuestaConfig().responsableIds;
}
