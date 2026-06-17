import type { CreatePageResponse } from "@notionhq/client/build/src/api-endpoints";
import { todayIsoDate } from "./dates";
import { getNotionClient } from "./notion-client";
import { getNotionConfig } from "./notion-config";
import { markdownToNotionBlocks, evidenceImageBlocks } from "./notion-blocks";
import {
  notionDate,
  notionMultiSelect,
  notionRelation,
  notionRichText,
  notionSelect,
  notionStatus,
  notionTitle,
} from "./notion-properties";
import { resolveCurrentSprintId } from "./notion-sprint";
import { getNotionTags } from "./project-profiles";
import { FormattedIncident, ServiceError } from "./types";

interface CreateIncidentArgs {
  formatted: FormattedIncident;
  fileUploadIds: string[];
  clientProject: string;
}

/**
 * Crea la tarea en Notion con properties (etiquetas, categoría, cliente, sprint, fechas)
 * y el cuerpo formateado por DeepSeek + evidencias adjuntas.
 */
export async function createIncidentPage(args: CreateIncidentArgs): Promise<CreatePageResponse> {
  const config = getNotionConfig();
  const notion = getNotionClient();
  const { formatted, fileUploadIds, clientProject } = args;
  const { props, defaults } = config;
  const today = todayIsoDate();

  const bodyBlocks = [
    ...markdownToNotionBlocks(formatted.bodyMarkdown),
    ...evidenceImageBlocks(fileUploadIds),
  ];

  const properties: Record<string, unknown> = {
    [props.title]: notionTitle(formatted.taskTitle),
    [props.description]: notionRichText(formatted.shortDescription),
    [props.priority]: notionSelect(formatted.notionPriority),
    [props.category]: notionMultiSelect(defaults.category),
    [props.project]: notionRelation([config.projectRelationId]),
    [props.client]: notionMultiSelect([defaults.client]),
    [props.clientProject]: notionMultiSelect([clientProject]),
    [props.ticketType]: notionSelect(defaults.ticketType),
    [props.status]: notionStatus(defaults.status),
    [props.tags]: notionMultiSelect(getNotionTags(clientProject)),
  };

  for (const dateProp of config.datePropertyNames) {
    properties[dateProp] = notionDate(today);
  }

  const sprintId = await resolveCurrentSprintId();
  if (sprintId) {
    properties[props.sprint] = notionRelation([sprintId]);
  }

  try {
    return await notion.pages.create({
      parent: { database_id: config.databaseId },
      properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
      children: bodyBlocks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido de Notion.";
    throw new ServiceError(
      `No se pudo crear la tarea en Notion. Verifica que la integración esté conectada a la base de datos y que los nombres de las properties coincidan. Detalle: ${message}`,
      502
    );
  }
}
