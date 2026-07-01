import { buildDocumentParentNotionBlocks } from "./document-parent-blocks";
import { parseDocumentIncidents } from "./document-transcription";
import { generateDocumentTicketSummary } from "./deepseek-document-summary";
import { generateIncidentSubtasks } from "./deepseek-incident-subtasks";
import {
  buildDocumentTicketTitle,
  buildLiteralIncidentBody,
  buildLiteralIncidentSubtaskBody,
  buildTicketTitle,
  highestIncidentPriority,
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
import { ServiceError } from "./types";

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
    title: string;
    shortDescription: string;
    bodyMarkdown: string;
  }
): TeamTaskFormData {
  const config = getNotionConfig();
  const teamEnvironment = mapIncidentEnvironment(base.environment);
  const bodyMarkdown = buildTeamBodyMarkdown(base.bodyMarkdown, teamEnvironment, "Fullstack");

  return {
    title: base.title.trim(),
    shortDescription: base.shortDescription.trim().slice(0, 200),
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

async function createIncidentSubtasks(
  parentPageId: string,
  clientProject: string,
  subtaskDefs: Array<{
    title: string;
    shortDescription: string;
    bodyMarkdown: string;
    notionPriority: string;
    environment: string;
    imageFiles: File[];
  }>
): Promise<CreatedIncidentSubtask[]> {
  const tags = getNotionTags(clientProject);
  const createdSubtasks: CreatedIncidentSubtask[] = [];

  for (const sub of subtaskDefs) {
    const imageUploadIds = await uploadEvidenceImages(sub.imageFiles);
    const subForm = buildSubtaskForm({
      clientProject,
      notionPriority: sub.notionPriority,
      environment: sub.environment,
      parentTaskId: parentPageId,
      tags,
      title: sub.title,
      shortDescription: sub.shortDescription,
      bodyMarkdown: sub.bodyMarkdown,
    });

    const subPage = await createTeamTaskPage(subForm, imageUploadIds);
    createdSubtasks.push({
      pageId: subPage.id,
      pageUrl: "url" in subPage ? (subPage.url as string) : null,
      title: subForm.title,
    });
  }

  return createdSubtasks;
}

/**
 * Documento completo: un ticket padre (transcripción + resumen IA) y una subtarea por incidencia.
 */
export async function processAndCreateDocumentTicket(
  incidents: IncidentFormData[],
  imagesByIncident: File[][],
  docFile: File,
  documentText: string
): Promise<CreatedIncident> {
  if (incidents.length === 0) {
    throw new ServiceError("No se detectaron incidencias en el documento.", 400);
  }

  const clientProject = incidents[0].clientProject;
  const aiSummary = await generateDocumentTicketSummary(
    documentText,
    incidents.length,
    clientProject,
    docFile.name
  );

  const taskTitle = buildDocumentTicketTitle(docFile.name);
  const parentPriority = mapFormPriorityToNotion(highestIncidentPriority(incidents));
  const shortDescription = aiSummary.slice(0, 200);

  const parsedSections = parseDocumentIncidents(documentText);
  const imagesByIncidentUploadIds: string[][] = [];
  for (let i = 0; i < incidents.length; i++) {
    const ids = await uploadEvidenceImages(imagesByIncident[i] ?? []);
    imagesByIncidentUploadIds.push(ids);
  }

  const documentUploadIds: string[] = [];
  if (docFile.size > 0) {
    const docId = await uploadFileToNotion(docFile);
    documentUploadIds.push(docId);
  }

  const parentBodyBlocks = buildDocumentParentNotionBlocks({
    aiSummary,
    documentText,
    fileName: docFile.name,
    sections: parsedSections.map((section, index) => ({
      number: section.number,
      imageUploadIds: imagesByIncidentUploadIds[index] ?? [],
      evidenceCaptions: section.evidenceCaptions,
    })),
    documentUploadIds,
  });

  const parentPage = await createTicketParentPage({
    taskTitle,
    shortDescription,
    notionPriority: parentPriority,
    prebuiltBodyBlocks: parentBodyBlocks,
    imageUploadIds: [],
    documentUploadIds: [],
    clientProject,
  });

  const subtaskDefs = incidents.map((incident, index) => ({
    title: incident.title.trim() || `Incidencia ${String(index + 1).padStart(3, "0")}`,
    shortDescription: (incident.summary || incident.justification || incident.title).trim().slice(0, 200),
    bodyMarkdown: buildLiteralIncidentSubtaskBody(incident, index),
    notionPriority: mapFormPriorityToNotion(incident.priority),
    environment: incident.environment,
    imageFiles: imagesByIncident[index] ?? [],
  }));

  const createdSubtasks = await createIncidentSubtasks(parentPage.id, clientProject, subtaskDefs);
  const evidenceCount = imagesByIncident.reduce((sum, imgs) => sum + imgs.length, 0);

  return {
    pageId: parentPage.id,
    pageUrl: "url" in parentPage ? (parentPage.url as string) : null,
    taskTitle,
    evidenceCount,
    subtasks: createdSubtasks,
  };
}

/** Formulario manual: ticket padre + subtareas sugeridas por IA (flujo de una incidencia). */
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
  const createdSubtasks = await createIncidentSubtasks(
    parentPage.id,
    form.clientProject,
    suggestedSubtasks.map((sub) => ({
      title: sub.title,
      shortDescription: sub.shortDescription,
      bodyMarkdown: sub.bodyMarkdown ?? "",
      notionPriority,
      environment: form.environment,
      imageFiles: [],
    }))
  );

  return {
    pageId: parentPage.id,
    pageUrl: "url" in parentPage ? (parentPage.url as string) : null,
    taskTitle,
    evidenceCount: imageUploadIds.length,
    subtasks: createdSubtasks,
  };
}
