import { getNotionClient } from "./notion-client";
import { ServiceError } from "./types";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // Límite Notion single-part upload.

/**
 * Sube un Buffer/Uint8Array a Notion (PDF generado en servidor, etc.).
 * Devuelve el file_upload.id para adjuntarlo a bloques image/file.
 */
export async function uploadBufferToNotion(
  data: Buffer | Uint8Array,
  filename: string,
  contentType = "application/octet-stream"
): Promise<string> {
  const size = data.byteLength;
  if (size > MAX_FILE_BYTES) {
    throw new ServiceError(
      `El archivo "${filename}" supera el límite de 20 MB de Notion.`,
      400
    );
  }
  if (size === 0) {
    throw new ServiceError(`El archivo "${filename}" está vacío.`, 400);
  }

  const notion = getNotionClient();
  const safeName = filename.trim() || "archivo.bin";

  let upload;
  try {
    upload = await notion.fileUploads.create({
      mode: "single_part",
      filename: safeName,
      content_type: contentType,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    throw new ServiceError(`No se pudo iniciar la subida en Notion: ${msg}`, 502);
  }

  try {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const blob = new Blob([buffer], { type: contentType });
    const sent = await notion.fileUploads.send({
      file_upload_id: upload.id,
      file: { filename: safeName, data: blob },
    });

    if (sent.status !== "uploaded") {
      throw new ServiceError(
        `Notion no completó la subida de "${safeName}" (estado: ${sent.status}).`,
        502
      );
    }

    return upload.id;
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    const msg = err instanceof Error ? err.message : "Error desconocido";
    throw new ServiceError(`Error al subir "${safeName}" a Notion: ${msg}`, 502);
  }
}

/**
 * Sube un archivo directamente a Notion (imagen, PDF, DOCX, etc.).
 * Devuelve el file_upload.id para adjuntarlo a bloques image/file.
 */
export async function uploadFileToNotion(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ServiceError(
      `El archivo "${file.name}" supera el límite de 20 MB de Notion.`,
      400
    );
  }

  const contentType = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadBufferToNotion(buffer, file.name, contentType);
}

/** Sube una imagen directamente a Notion (sin servicios externos). */
export async function uploadImageToNotion(file: File): Promise<string> {
  return uploadFileToNotion(file);
}

/** Sube todas las evidencias en paralelo y devuelve los IDs de file_upload. */
export async function uploadEvidenceImages(files: File[]): Promise<string[]> {
  const images = files.filter((f) => f.size > 0);
  if (images.length === 0) return [];
  return Promise.all(images.map(uploadFileToNotion));
}
