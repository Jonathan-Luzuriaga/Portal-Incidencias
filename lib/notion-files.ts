import { getNotionClient } from "./notion-client";
import { ServiceError } from "./types";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // Límite Notion single-part upload.

/**
 * Sube una imagen directamente a Notion (sin servicios externos).
 * Devuelve el file_upload.id para adjuntarlo a bloques image.
 */
export async function uploadImageToNotion(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ServiceError(
      `La imagen "${file.name}" supera el límite de 20 MB de Notion.`,
      400
    );
  }

  const notion = getNotionClient();
  const contentType = file.type || "application/octet-stream";

  let upload;
  try {
    upload = await notion.fileUploads.create({
      mode: "single_part",
      filename: file.name,
      content_type: contentType,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    throw new ServiceError(`No se pudo iniciar la subida en Notion: ${msg}`, 502);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = new Blob([buffer], { type: contentType });
    const sent = await notion.fileUploads.send({
      file_upload_id: upload.id,
      file: { filename: file.name, data: blob },
    });

    if (sent.status !== "uploaded") {
      throw new ServiceError(
        `Notion no completó la subida de "${file.name}" (estado: ${sent.status}).`,
        502
      );
    }

    return upload.id;
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    const msg = err instanceof Error ? err.message : "Error desconocido";
    throw new ServiceError(`Error al subir "${file.name}" a Notion: ${msg}`, 502);
  }
}

/** Sube todas las evidencias en paralelo y devuelve los IDs de file_upload. */
export async function uploadEvidenceImages(files: File[]): Promise<string[]> {
  const images = files.filter((f) => f.size > 0);
  if (images.length === 0) return [];
  return Promise.all(images.map(uploadImageToNotion));
}
