import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { ServiceError } from "./types";

const MAX_DOC_BYTES = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXT = /\.(pdf|docx)$/i;

function isAllowedDocument(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  return ALLOWED_EXT.test(file.name);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

/** Extrae texto plano de un PDF o DOCX de reporte de incidencias. */
export async function extractDocumentText(file: File): Promise<string> {
  if (file.size > MAX_DOC_BYTES) {
    throw new ServiceError(`"${file.name}" supera el límite de 15 MB.`, 400);
  }
  if (!isAllowedDocument(file)) {
    throw new ServiceError("Solo se aceptan archivos PDF o DOCX.", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  const text = isPdf ? await extractPdfText(buffer) : await extractDocxText(buffer);

  if (!text || text.length < 40) {
    throw new ServiceError(
      "No se pudo leer texto del documento. Verifica que no esté escaneado como imagen.",
      400
    );
  }

  return text;
}
