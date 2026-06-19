import type { CreatePageResponse } from "@notionhq/client/build/src/api-endpoints";
import { todayIsoDate } from "./dates";
import { getNotionClient } from "./notion-client";
import { getNotionConfig } from "./notion-config";
import { markdownToNotionBlocks, evidenceImageBlocks } from "./notion-blocks";
import {
  notionDate,
  notionMultiSelect,
  notionNumber,
  notionRelation,
  notionRichText,
  notionSelect,
  notionStatus,
  notionTitle,
  notionUrl,
} from "./notion-properties";
import { resolveCurrentSprintId } from "./notion-sprint";
import { getDefaultTeamTags } from "./team-profiles";
import type { TeamTaskFormData } from "./team-types";
import { ServiceError } from "./types";

/**
 * Crea una tarea en Notion desde el portal interno de equipo.
 * Sin formateo DeepSeek en creación directa; el pipeline puede estructurar antes vía deepseek-team.
 */
export async function createTeamTaskPage(
  form: TeamTaskFormData,
  fileUploadIds: string[]
): Promise<CreatePageResponse> {
  const config = getNotionConfig();
  const notion = getNotionClient();
  const { props, defaults } = config;
  const today = todayIsoDate();

  const bodyMarkdown = form.bodyMarkdown.trim();
  const bodyBlocks = [
    ...(bodyMarkdown ? markdownToNotionBlocks(bodyMarkdown) : []),
    ...evidenceImageBlocks(fileUploadIds),
  ];

  const tags = getDefaultTeamTags(form.ticketType, form.clientProject, form.tags);

  const properties: Record<string, unknown> = {
    [props.title]: notionTitle(form.title),
    [props.description]: notionRichText(form.shortDescription),
    [props.priority]: notionSelect(form.priority),
    [props.category]: notionMultiSelect([form.category]),
    [props.project]: notionRelation([form.projectRelationId]),
    [props.client]: notionMultiSelect([form.client]),
    [props.clientProject]: notionMultiSelect([form.clientProject]),
    [props.ticketType]: notionSelect(form.ticketType),
    [props.status]: notionStatus(defaults.status),
    [props.tags]: notionMultiSelect(tags),
  };

  if (form.prLink) {
    properties["PR link"] = notionUrl(form.prLink);
  }

  if (form.hours != null && form.hours > 0) {
    properties["Horas por tarea"] = notionNumber(form.hours);
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
      `No se pudo crear la tarea en Notion. Verifica la integración y los nombres de las properties. Detalle: ${message}`,
      502
    );
  }
}
