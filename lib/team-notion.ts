import type { CreatePageResponse } from "@notionhq/client/build/src/api-endpoints";
import { todayIsoDate } from "./dates";
import { getNotionClient } from "./notion-client";
import { getNotionConfig } from "./notion-config";
import { markdownToNotionBlocks, evidenceImageBlocks } from "./notion-blocks";
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
  notionUrl,
} from "./notion-properties";
import { resolveCurrentSprintId } from "./notion-sprint";
import { getTeamNotionProps } from "./team-notion-config";
import { getProjectFieldMode } from "./team-notion-meta";
import { getDefaultTeamTags, buildTeamBodyMarkdown, resolveTeamProject } from "./team-profiles";
import { resolveTeamProjectRelationId } from "./team-project-relations";
import type { TeamTaskFormData } from "./team-types";
import { ServiceError } from "./types";

/**
 * Crea una tarea en Notion desde el portal interno de equipo.
 */
export async function createTeamTaskPage(
  form: TeamTaskFormData,
  fileUploadIds: string[] = []
): Promise<CreatePageResponse> {
  const config = getNotionConfig();
  const teamProps = getTeamNotionProps();
  const notion = getNotionClient();
  const { props, defaults } = config;
  const today = todayIsoDate();

  const bodyMarkdown = buildTeamBodyMarkdown(
    form.bodyMarkdown,
    form.environment,
    form.scope
  );
  const bodyBlocks = [
    ...(bodyMarkdown ? markdownToNotionBlocks(bodyMarkdown) : []),
    ...evidenceImageBlocks(fileUploadIds),
  ];

  const tags = getDefaultTeamTags(
    form.ticketType,
    form.clientProject,
    form.tags,
    form.environment
  );

  const categories =
    form.categories.length > 0 ? form.categories : [form.category].filter(Boolean);

  const projectMode = await getProjectFieldMode();
  let projectValue: string;
  if (projectMode === "relation") {
    // En modo relation el formulario envía el UUID de la página del proyecto.
    // Debe resolverse directamente (resolveTeamProject lo colapsaría a Bago).
    projectValue = resolveTeamProjectRelationId(form.projectRelationId);
  } else {
    projectValue = resolveTeamProject(form.projectRelationId);
  }

  const properties: Record<string, unknown> = {
    [props.title]: notionTitle(form.title),
    [props.description]: notionRichText(form.shortDescription),
    [props.priority]: notionSelect(form.priority),
    [props.category]: notionMultiSelect(categories),
    [props.client]: notionMultiSelect([form.client]),
    [props.clientProject]: notionMultiSelect([form.clientProject]),
    [props.ticketType]: notionSelect(form.ticketType),
    [props.status]: notionStatus(defaults.status),
    [props.tags]: notionMultiSelect(tags),
  };

  if (projectMode === "relation") {
    properties[props.project] = notionRelation([projectValue]);
  } else if (projectMode === "select") {
    properties[props.project] = notionSelect(projectValue);
  } else {
    properties[props.project] = notionMultiSelect([projectValue]);
  }

  if (form.assigneeIds.length > 0) {
    properties[teamProps.assignee] = notionPeople(form.assigneeIds);
  }

  const reviewers = form.reviewerIds.filter(Boolean);
  if (reviewers.length > 0) {
    properties["Revisores"] = notionPeople(reviewers);
  }

  if (form.parentTaskId) {
    properties[teamProps.parent] = notionRelation([form.parentTaskId]);
  }

  if (form.prLink) {
    properties["PR link"] = notionUrl(form.prLink);
  }

  const hoursProp = process.env.NOTION_PROP_HOURS?.trim();
  if (hoursProp && form.hours != null && form.hours > 0) {
    properties[hoursProp] = notionNumber(form.hours);
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
      `No se pudo crear la tarea en Notion. Verifica la integración y los nombres de las properties. ` +
        `Columna tipo: "${props.ticketType}". Detalle: ${message}`,
      502
    );
  }
}
