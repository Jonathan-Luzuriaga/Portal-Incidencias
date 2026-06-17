import { ServiceError } from "./types";
import { parseCsvValues } from "./notion-properties";
import { parseDatePropertyNames } from "./dates";

/** Configuración de properties y valores por defecto de la base de datos Notion. */
export interface NotionConfig {
  databaseId: string;
  props: {
    title: string;
    description: string;
    priority: string;
    category: string;
    project: string;
    tags: string;
    client: string;
    clientProject: string;
    ticketType: string;
    status: string;
    sprint: string;
  };
  datePropertyNames: string[];
  defaults: {
    client: string;
    category: string[];
    ticketType: string;
    status: string;
    tags: string[];
    projectContext: string;
  };
  projectRelationId: string;
  priorityMap: Record<"Alto" | "Medio" | "Bajo", string>;
}

export function getNotionConfig(): NotionConfig {
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!databaseId) {
    throw new ServiceError("Falta NOTION_DATABASE_ID en la configuración del servidor.", 500);
  }

  const tagsRaw = process.env.NOTION_DEFAULT_TAGS ?? "tareas,bugs,qa,Frontend,UX/UI";
  const categoryRaw = process.env.NOTION_DEFAULT_CATEGORY ?? "BUG,Frontend";

  const projectRelationId = process.env.NOTION_PROJECT_RELATION_ID;
  if (!projectRelationId) {
    throw new ServiceError(
      "Falta NOTION_PROJECT_RELATION_ID (page id del proyecto Bago en la columna Proyecto).",
      500
    );
  }

  return {
    databaseId,
    projectRelationId,
    props: {
      title: process.env.NOTION_PROP_TITLE ?? "herramienta",
      description: process.env.NOTION_PROP_DESCRIPTION ?? "Descripción",
      priority: process.env.NOTION_PROP_PRIORITY ?? "Prioridad",
      category: process.env.NOTION_PROP_CATEGORY ?? "Categoria",
      project: process.env.NOTION_PROP_PROJECT ?? "Proyecto",
      tags: process.env.NOTION_PROP_TAGS ?? "Etiquetas",
      client: process.env.NOTION_PROP_CLIENT ?? "Cliente",
      clientProject: process.env.NOTION_PROP_CLIENT_PROJECT ?? "Proyecto Cliente",
      ticketType: process.env.NOTION_PROP_TICKET_TYPE ?? "Tipo de etiqueta",
      status: process.env.NOTION_PROP_STATUS ?? "Estado",
      sprint: process.env.NOTION_PROP_SPRINT ?? "Sprint",
    },
    datePropertyNames: parseDatePropertyNames(process.env.NOTION_DATE_PROPERTIES),
    defaults: {
      client: process.env.NOTION_DEFAULT_CLIENT ?? "Bago",
      category: parseCsvValues(categoryRaw),
      ticketType: process.env.NOTION_DEFAULT_TICKET_TYPE ?? "Incidencia",
      status: process.env.NOTION_DEFAULT_STATUS ?? "Sin empezar",
      tags: parseCsvValues(tagsRaw),
      projectContext: process.env.NOTION_PROJECT_CONTEXT ?? "SGC Front",
    },
    priorityMap: {
      Alto: process.env.NOTION_PRIORITY_ALTO ?? "Alta",
      Medio: process.env.NOTION_PRIORITY_MEDIO ?? "Media",
      Bajo: process.env.NOTION_PRIORITY_BAJO ?? "Baja",
    },
  };
}
