import type { CreatePageResponse } from "@notionhq/client/build/src/api-endpoints";
import { todayIsoDate } from "./dates";
import { getNotionClient } from "./notion-client";
import { getNotionConfig } from "./notion-config";
import { markdownToNotionBlocks } from "./notion-blocks";
import {
  notionDate,
  notionMultiSelect,
  notionNumber,
  notionPeople,
  notionRelation,
  notionRichText,
  notionSelect,
  notionStatus,
  notionTitle,
} from "./notion-properties";
import { resolveCurrentSprintId } from "./notion-sprint";
import { getPropuestaConfig } from "./propuesta-config";
import { getTeamNotionProps } from "./team-notion-config";
import type { FormattedPropuesta } from "./deepseek-propuesta";
import { ServiceError } from "./types";

export interface CreatePropuestaArgs {
  formatted: FormattedPropuesta;
  reviewerIds: string[];
  assigneeIds?: string[];
  priority?: string;
}

/** Crea una tarea de Propuesta en Notion con responsables y revisores elegidos. */
export async function createPropuestaPage(args: CreatePropuestaArgs): Promise<CreatePageResponse> {
  const { formatted, reviewerIds, assigneeIds, priority } = args;
  const config = getNotionConfig();
  const propuesta = getPropuestaConfig();
  const teamProps = getTeamNotionProps();
  const notion = getNotionClient();
  const { props } = config;
  const today = todayIsoDate();

  const bodyBlocks = formatted.bodyMarkdown.trim()
    ? markdownToNotionBlocks(formatted.bodyMarkdown)
    : [];

  const properties: Record<string, unknown> = {
    [props.title]: notionTitle(formatted.title),
    [props.description]: notionRichText(formatted.shortDescription),
    [props.priority]: notionSelect(priority || formatted.priority || propuesta.prioridadDefault),
    [props.category]: notionMultiSelect(propuesta.categoria),
    [props.tags]: notionMultiSelect(propuesta.etiquetas),
    [props.project]: notionRelation([propuesta.projectRelationId]),
    [props.status]: notionStatus(propuesta.estado),
  };

  const responsables = (assigneeIds?.length ? assigneeIds : propuesta.responsableIds).filter(Boolean);
  if (responsables.length > 0) {
    properties[teamProps.assignee] = notionPeople(responsables);
  }

  const reviewers = reviewerIds.filter(Boolean);
  if (reviewers.length > 0) {
    properties["Revisores"] = notionPeople(reviewers);
  }

  if (formatted.totalHours != null && formatted.totalHours > 0) {
    properties["Horas por tarea"] = notionNumber(formatted.totalHours);
  }

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
      children: bodyBlocks.length > 0 ? bodyBlocks : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido de Notion.";
    throw new ServiceError(
      `No se pudo crear la propuesta en Notion. Verifica properties y permisos. Detalle: ${message}`,
      502
    );
  }
}
