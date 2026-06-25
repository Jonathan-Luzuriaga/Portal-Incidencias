import { formatTeamTaskFromRaw } from "./deepseek-team";
import { createTeamTaskPage } from "./team-notion";
import { uploadEvidenceImages } from "./notion-files";
import {
  buildTeamBodyMarkdown,
  inferClientFromClientProject,
  scopeToCategories,
} from "./team-profiles";
import type {
  CreatedTeamTaskSummary,
  FormattedTeamTask,
  TeamAdditionalTaskInput,
  TeamTaskFormData,
} from "./team-types";

/** Combina salida de IA con decisiones del PM (estas ganan). */
export function applyFormattedTeamTask(
  form: TeamTaskFormData,
  formatted: FormattedTeamTask
): TeamTaskFormData {
  const clientProject = form.clientProject || formatted.clientProject;
  const categories = scopeToCategories(form.scope);

  let subtasks =
    form.ticketType === "Épica"
      ? form.subtasks.filter((s) => s.enabled && s.title.trim())
      : [];

  if (subtasks.length === 0 && form.ticketType === "Épica") {
    subtasks = formatted.subtasks.map((s) => ({
      title: s.title,
      shortDescription: s.shortDescription,
      bodyMarkdown: s.bodyMarkdown,
      enabled: true,
    }));
  }

  const bodyMarkdown = buildTeamBodyMarkdown(
    formatted.bodyMarkdown,
    form.environment,
    form.scope
  );

  return {
    title: formatted.title,
    shortDescription: formatted.shortDescription,
    bodyMarkdown,
    ticketType: form.ticketType,
    priority: formatted.priority,
    category: form.category || categories[0] || formatted.category,
    categories,
    environment: form.environment,
    scope: form.scope,
    tags: formatted.tags,
    client: inferClientFromClientProject(clientProject),
    clientProject,
    projectRelationId: form.projectRelationId,
    assigneeIds: form.assigneeIds,
    reviewerIds: form.reviewerIds,
    parentTaskId: form.parentTaskId,
    additionalTasks: form.additionalTasks,
    subtasks,
    prLink: form.prLink,
    hours: form.hours ?? formatted.hours,
  };
}

async function resolveTaskForm(
  base: TeamTaskFormData,
  options: { rawDescription?: string; useAi?: boolean; projectLabel?: string },
  imageFiles: File[]
): Promise<{ form: TeamTaskFormData; fileUploadIds: string[] }> {
  let finalForm: TeamTaskFormData = {
    ...base,
    client: inferClientFromClientProject(base.clientProject),
    categories: base.categories.length > 0 ? base.categories : scopeToCategories(base.scope),
    category: base.category || scopeToCategories(base.scope)[0] || "Workflows",
    bodyMarkdown: buildTeamBodyMarkdown(base.bodyMarkdown, base.environment, base.scope),
    subtasks: base.ticketType === "Épica" ? base.subtasks : [],
    additionalTasks: base.ticketType === "Tarea" ? base.additionalTasks : [],
  };

  const raw = options.rawDescription?.trim();
  if (options?.useAi && raw) {
    const formatted = await formatTeamTaskFromRaw(raw, {
      ticketType: base.ticketType,
      clientProject: base.clientProject,
      client: inferClientFromClientProject(base.clientProject),
      projectLabel: options.projectLabel,
      environment: base.environment,
      scope: base.scope,
    });
    finalForm = applyFormattedTeamTask(base, formatted);
  }

  const fileUploadIds = await uploadEvidenceImages(imageFiles);
  return { form: finalForm, fileUploadIds };
}

async function createOneTask(
  form: TeamTaskFormData,
  fileUploadIds: string[]
): Promise<CreatedTeamTaskSummary> {
  const page = await createTeamTaskPage(form, fileUploadIds);
  return {
    pageId: page.id,
    pageUrl: "url" in page ? (page.url as string) : null,
    taskTitle: form.title,
    evidenceCount: fileUploadIds.length,
  };
}

/** Pipeline: IA opcional → tarea(s) → subtareas (solo Épica) → Notion. */
export async function processAndCreateTeamTask(
  form: TeamTaskFormData,
  imageFiles: File[],
  options?: {
    rawDescription?: string;
    useAi?: boolean;
    projectLabel?: string;
    additionalImages?: File[][];
  }
): Promise<CreatedTeamTaskSummary[]> {
  const { form: finalForm, fileUploadIds } = await resolveTaskForm(form, options ?? {}, imageFiles);

  const created: CreatedTeamTaskSummary[] = [];

  const mainPage = await createTeamTaskPage(finalForm, fileUploadIds);
  created.push({
    pageId: mainPage.id,
    pageUrl: "url" in mainPage ? (mainPage.url as string) : null,
    taskTitle: finalForm.title,
    evidenceCount: fileUploadIds.length,
  });

  if (finalForm.ticketType === "Épica") {
    const subtasks = finalForm.subtasks.filter((s) => s.enabled && s.title.trim());
    for (const sub of subtasks) {
      const subBody = sub.bodyMarkdown?.trim()
        ? buildTeamBodyMarkdown(sub.bodyMarkdown, finalForm.environment, finalForm.scope)
        : buildTeamBodyMarkdown(
            `## Contexto\nSubtarea de la épica **${finalForm.title}**.\n\n## Objetivo\n${sub.shortDescription || sub.title}\n\n## Alcance\n(Por completar)\n\n## Criterios de aceptación\n- `,
            finalForm.environment,
            finalForm.scope
          );

      const subPage = await createTeamTaskPage(
        {
          ...finalForm,
          title: sub.title.trim(),
          shortDescription: (sub.shortDescription || sub.title).trim(),
          bodyMarkdown: subBody,
          ticketType: "Tarea",
          parentTaskId: mainPage.id,
          subtasks: [],
          additionalTasks: [],
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
  }

  if (finalForm.ticketType === "Tarea") {
    for (let i = 0; i < finalForm.additionalTasks.length; i++) {
      const extra = finalForm.additionalTasks[i];
      if (!extra.rawInput.trim() && !extra.title.trim()) continue;

      let extraForm: TeamTaskFormData = {
        ...finalForm,
        title: extra.title,
        shortDescription: extra.shortDescription,
        bodyMarkdown: buildTeamBodyMarkdown(extra.bodyMarkdown, finalForm.environment, finalForm.scope),
        subtasks: [],
        additionalTasks: [],
      };

      if (options?.useAi !== false && extra.rawInput.trim()) {
        const formatted = await formatTeamTaskFromRaw(extra.rawInput.trim(), {
          ticketType: "Tarea",
          clientProject: finalForm.clientProject,
          client: finalForm.client,
          projectLabel: options?.projectLabel,
          environment: finalForm.environment,
          scope: finalForm.scope,
        });
        extraForm = {
          ...extraForm,
          title: formatted.title,
          shortDescription: formatted.shortDescription,
          bodyMarkdown: buildTeamBodyMarkdown(
            formatted.bodyMarkdown,
            finalForm.environment,
            finalForm.scope
          ),
          priority: formatted.priority,
          category: formatted.category,
          tags: formatted.tags,
          hours: formatted.hours ?? extraForm.hours,
        };
      }

      const extraImages = options?.additionalImages?.[i] ?? [];
      const extraUploadIds = await uploadEvidenceImages(extraImages);
      const summary = await createOneTask(extraForm, extraUploadIds);
      created.push(summary);
    }
  }

  return created;
}
