import { formatTeamTaskFromRaw } from "./deepseek-team";
import { createTeamTaskPage } from "./team-notion";
import { uploadEvidenceImages } from "./notion-files";
import { getProjectMetadata } from "./team-profiles";
import type {
  CreatedTeamTaskSummary,
  FormattedTeamTask,
  TeamTaskFormData,
} from "./team-types";

/** Combina salida de IA con decisiones del PM (estas ganan). */
export function applyFormattedTeamTask(
  form: TeamTaskFormData,
  formatted: FormattedTeamTask
): TeamTaskFormData {
  const meta = getProjectMetadata(form.projectRelationId);
  const enabledFromForm = form.subtasks.filter((s) => s.enabled && s.title.trim());

  const subtasks =
    enabledFromForm.length > 0
      ? enabledFromForm
      : formatted.subtasks.map((s) => ({
          title: s.title,
          shortDescription: s.shortDescription,
          enabled: true,
        }));

  return {
    title: formatted.title,
    shortDescription: formatted.shortDescription,
    bodyMarkdown: formatted.bodyMarkdown,
    ticketType: form.ticketType,
    priority: formatted.priority,
    category: formatted.category,
    tags: formatted.tags,
    client: meta.client,
    clientProject: meta.clientProject,
    projectRelationId: form.projectRelationId,
    assigneeId: form.assigneeId,
    parentTaskId: form.parentTaskId,
    subtasks,
    prLink: form.prLink,
    hours: form.hours ?? formatted.hours,
  };
}

/** Pipeline: IA opcional → tarea principal → subtareas → Notion. */
export async function processAndCreateTeamTask(
  form: TeamTaskFormData,
  imageFiles: File[],
  options?: { rawDescription?: string; useAi?: boolean }
): Promise<CreatedTeamTaskSummary[]> {
  let finalForm = form;

  const raw = options?.rawDescription?.trim();
  if (options?.useAi && raw) {
    const projectMeta = getProjectMetadata(form.projectRelationId);
    const formatted = await formatTeamTaskFromRaw(raw, {
      ticketType: form.ticketType,
      clientProject: projectMeta.clientProject,
      client: projectMeta.client,
    });
    finalForm = applyFormattedTeamTask(form, formatted);
  }

  const fileUploadIds = await uploadEvidenceImages(imageFiles);
  const mainPage = await createTeamTaskPage(finalForm, fileUploadIds);

  const created: CreatedTeamTaskSummary[] = [
    {
      pageId: mainPage.id,
      pageUrl: "url" in mainPage ? (mainPage.url as string) : null,
      taskTitle: finalForm.title,
      evidenceCount: fileUploadIds.length,
    },
  ];

  const subtasks = finalForm.subtasks.filter((s) => s.enabled && s.title.trim());
  for (const sub of subtasks) {
    const subPage = await createTeamTaskPage(
      {
        ...finalForm,
        title: sub.title.trim(),
        shortDescription: (sub.shortDescription || sub.title).trim(),
        bodyMarkdown: `## Subtarea de: ${finalForm.title}\n\n${sub.shortDescription || sub.title}`,
        ticketType: "Tarea",
        parentTaskId: mainPage.id,
        subtasks: [],
        prLink: "",
        hours: null,
      },
      []
    );

    created.push({
      pageId: subPage.id,
      pageUrl: "url" in subPage ? (subPage.url as string) : null,
      taskTitle: sub.title.trim(),
      evidenceCount: 0,
    });
  }

  return created;
}
