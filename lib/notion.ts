import type { CreatePageResponse } from "@notionhq/client/build/src/api-endpoints";
import { todayIsoDate } from "./dates";
import { getNotionClient } from "./notion-client";
import { getNotionConfig } from "./notion-config";
import {
  documentFileBlocks,
  evidenceImageBlocks,
  markdownToNotionBlocks,
} from "./notion-blocks";
import {
  notionDate,
  notionMultiSelect,
  notionPeople,
  notionRelation,
  notionRichText,
  notionSelect,
  notionStatus,
  notionTitle,
} from "./notion-properties";
import { resolveCurrentSprintId } from "./notion-sprint";
import { getNotionTags } from "./project-profiles";
import { getPmAssigneeIds } from "./propuesta-config";
import { resolveTeamProjectRelationId } from "./team-project-relations";
import { appendNotionChildren, splitNotionChildren } from "./notion-page-children";
import { getTeamNotionProps } from "./team-notion-config";
import { ServiceError } from "./types";

interface CreateTicketParentArgs {
  taskTitle: string;
  shortDescription: string;
  notionPriority: string;
  bodyMarkdown: string;
  imageUploadIds: string[];
  documentUploadIds: string[];
  clientProject: string;
}

/**
 * Crea el ticket padre (tipo Ticket) con transcripción literal,
 * evidencias y documento adjunto si aplica.
 */
export async function createTicketParentPage(
  args: CreateTicketParentArgs
): Promise<CreatePageResponse> {
  const config = getNotionConfig();
  const notion = getNotionClient();
  const {
    taskTitle,
    shortDescription,
    notionPriority,
    bodyMarkdown,
    imageUploadIds,
    documentUploadIds,
    clientProject,
  } = args;
  const { props, defaults } = config;
  const today = todayIsoDate();

  const bodyBlocks = [
    ...markdownToNotionBlocks(bodyMarkdown),
    ...evidenceImageBlocks(imageUploadIds),
    ...documentFileBlocks(documentUploadIds),
  ];

  const properties: Record<string, unknown> = {
    [props.title]: notionTitle(taskTitle),
    [props.description]: notionRichText(shortDescription),
    [props.priority]: notionSelect(notionPriority),
    [props.category]: notionMultiSelect(defaults.category),
    [props.project]: notionRelation([
      resolveTeamProjectRelationId(config.projectRelationId),
    ]),
    [props.client]: notionMultiSelect([defaults.client]),
    [props.clientProject]: notionMultiSelect([clientProject]),
    [props.ticketType]: notionSelect(config.incidentTicketType),
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

  const assigneeIds = getPmAssigneeIds();
  if (assigneeIds.length > 0) {
    properties[getTeamNotionProps().assignee] = notionPeople(assigneeIds);
  }

  const { initial, remainder } = splitNotionChildren(bodyBlocks);

  try {
    const page = await notion.pages.create({
      parent: { database_id: config.databaseId },
      properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
      children: initial.length > 0 ? initial : undefined,
    });

    await appendNotionChildren(page.id, remainder);
    return page;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido de Notion.";
    const ticketType = config.incidentTicketType;
    throw new ServiceError(
      `No se pudo crear el ticket en Notion. Verifica que la opción "${ticketType}" exista en la columna "${props.ticketType}" y que la integración esté conectada. Detalle: ${message}`,
      502
    );
  }
}
