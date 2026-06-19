import { formatTeamTaskFromRaw } from "./deepseek-team";
import { createTeamTaskPage } from "./team-notion";
import { uploadEvidenceImages } from "./notion-files";
import type { FormattedTeamTask, TeamTaskFormData } from "./team-types";

export interface CreatedTeamTask {
  pageId: string;
  pageUrl: string | null;
  taskTitle: string;
  evidenceCount: number;
}

/** Combina salida de IA con selecciones manuales del usuario. */
export function applyFormattedTeamTask(
  form: TeamTaskFormData,
  formatted: FormattedTeamTask
): TeamTaskFormData {
  return {
    ...formatted,
    projectRelationId: form.projectRelationId,
    clientProject: form.clientProject,
    prLink: form.prLink,
    hours: form.hours ?? formatted.hours,
  };
}

/** Pipeline: opcional IA → evidencias → crear tarea en Notion. */
export async function processAndCreateTeamTask(
  form: TeamTaskFormData,
  imageFiles: File[],
  options?: { rawDescription?: string; useAi?: boolean }
): Promise<CreatedTeamTask> {
  let finalForm = form;

  const raw = options?.rawDescription?.trim();
  if (options?.useAi && raw) {
    const formatted = await formatTeamTaskFromRaw(raw, {
      clientProject: form.clientProject,
      client: form.client,
    });
    finalForm = applyFormattedTeamTask(form, formatted);
  }

  const fileUploadIds = await uploadEvidenceImages(imageFiles);
  const page = await createTeamTaskPage(finalForm, fileUploadIds);

  return {
    pageId: page.id,
    pageUrl: "url" in page ? (page.url as string) : null,
    taskTitle: finalForm.title,
    evidenceCount: fileUploadIds.length,
  };
}
