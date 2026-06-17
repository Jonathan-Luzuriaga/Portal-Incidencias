import { formatIncidentForNotion } from "./deepseek";
import { createIncidentPage } from "./notion";
import { uploadEvidenceImages } from "./notion-files";
import type { IncidentFormData } from "./types";

export interface CreatedIncident {
  pageId: string;
  pageUrl: string | null;
  taskTitle: string;
  evidenceCount: number;
}

/** Pipeline completo: formatear → evidencias → crear en Notion. */
export async function processAndCreateIncident(
  form: IncidentFormData,
  imageFiles: File[]
): Promise<CreatedIncident> {
  const formatted = await formatIncidentForNotion(form);
  const fileUploadIds = await uploadEvidenceImages(imageFiles);
  const page = await createIncidentPage({
    formatted,
    fileUploadIds,
    clientProject: form.clientProject,
  });

  return {
    pageId: page.id,
    pageUrl: "url" in page ? (page.url as string) : null,
    taskTitle: formatted.taskTitle,
    evidenceCount: fileUploadIds.length,
  };
}
