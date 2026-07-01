import { generateIncidentSubtasks } from "./deepseek-incident-subtasks";
import {
  buildLiteralIncidentBody,
  buildTicketTitle,
  mapFormPriorityToNotion,
} from "./incident-literal";
import { createTicketParentPage } from "./notion";
import { uploadEvidenceImages, uploadFileToNotion } from "./notion-files";
import { buildTeamBodyMarkdown, inferClientFromClientProject } from "./team-profiles";
import { createTeamTaskPage } from "./team-notion";
import type { TeamPriority, TeamTaskFormData } from "./team-types";
import { getNotionConfig } from "./notion-config";
import { getNotionTags } from "./project-profiles";
import type { IncidentFormData } from "./types";

export interface CreatedIncidentSubtask {
  pageId: string;
  pageUrl: string | null;
  title: string;
}

export interface CreatedIncident {
  pageId: string;
  pageUrl: string | null;
  taskTitle: string;
  evidenceCount: number;
  subtasks: CreatedIncidentSubtask[];
}

export interface ProcessIncidentOptions {
  /** Archivo PDF/DOCX original para adjuntar al ticket padre. */
  documentFile?: File;
  /** Texto crudo de la sección del documento para esta incidencia. */
  documentSectionText?: string;
}

function mapNotionPriorityToTeam(priority: string): TeamPriority {
  if (priority === "Alta") return "Alta";
  if (priority === "Baja") return "Baja";
  return "Media";
}

function mapIncidentEnvironment(environment: string): TeamTaskFormData["environment"] {
  if (environment === "Desarrollo") return "Desarrollo";
  if (environment === "Producción") return "Despliegue";
  return "QA";
}

function buildSubtaskForm(
  base: {
    clientProject: string;
    notionPriority: string;
    environment: string;
    parentTaskId: string;
    tags: string[];
  },
  sub: { title: string; shortDescription: string; bodyMarkdown: string }
): TeamTaskFormData {
  const config = getNotionConfig();
  const teamEnvironment = mapIncidentEnvironment(base.environment);
  const bodyMarkdown = buildTeamBodyMarkdown(sub.bodyMarkdown, teamEnvironment, "Fullstack");

  return {
    title: sub.title.trim(),
    shortDescription: (sub.shortDescription || sub.title).trim().slice(0, 200),
    bodyMarkdown,
    ticketType: "Tarea",
    priority: mapNotionPriorityToTeam(base.notionPriority),
    client: inferClientFromClientProject(base.clientProject),
    clientProject: base.clientProject,
    projectRelationId: config.projectRelationId,
    assigneeIds: [],
    reviewerIds: [],
    parentTaskId: base.parentTaskId,
    additionalTasks: [],
    environment: teamEnvironment,
    scope: "Fullstack",
    categories: ["BUG", "Frontend"],
    category: "BUG",
    tags: base.tags,
    subtasks: [],
    prLink: "",
    hours: null,
  };
}

/** Pipeline: transcripción literal → ticket padre → subtareas IA → Notion. */
export async function processAndCreateIncident(
  form: IncidentFormData,
  imageFiles: File[],
  options?: ProcessIncidentOptions
): Promise<CreatedIncident> {
  const literalBody = buildLiteralIncidentBody(form, {
    documentFileName: options?.documentFile?.name,
    documentSectionText: options?.documentSectionText,
  });
  const taskTitle = buildTicketTitle(form);
  const notionPriority = mapFormPriorityToNotion(form.priority);
  const shortDescription = (form.summary || form.justification).trim().slice(0, 200);

  const imageUploadIds = await uploadEvidenceImages(imageFiles);

  const documentUploadIds: string[] = [];
  if (options?.documentFile && options.documentFile.size > 0) {
    const docId = await uploadFileToNotion(options.documentFile);
    documentUploadIds.push(docId);
  }

  const parentPage = await createTicketParentPage({
    taskTitle,
    shortDescription,
    notionPriority,
    bodyMarkdown: literalBody,
    imageUploadIds,
    documentUploadIds,
    clientProject: form.clientProject,
  });

  const suggestedSubtasks = await generateIncidentSubtasks(literalBody, form.clientProject);
  const tags = getNotionTags(form.clientProject);
  const createdSubtasks: CreatedIncidentSubtask[] = [];

  for (const sub of suggestedSubtasks) {
    const subForm = buildSubtaskForm(
      {
        clientProject: form.clientProject,
        notionPriority,
        environment: form.environment,
        parentTaskId: parentPage.id,
        tags,
      },
      {
        title: sub.title,
        shortDescription: sub.shortDescription,
        bodyMarkdown: sub.bodyMarkdown ?? "",
      }
    );

    const subPage = await createTeamTaskPage(subForm, []);
    createdSubtasks.push({
      pageId: subPage.id,
      pageUrl: "url" in subPage ? (subPage.url as string) : null,
      title: subForm.title,
    });
  }

  return {
    pageId: parentPage.id,
    pageUrl: "url" in parentPage ? (parentPage.url as string) : null,
    taskTitle,
    evidenceCount: imageUploadIds.length,
    subtasks: createdSubtasks,
  };
}
