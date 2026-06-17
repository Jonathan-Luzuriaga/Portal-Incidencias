import JSZip from "jszip";
import { PNG } from "pngjs";
import mammoth from "mammoth";
import { extractImages, extractText, getDocumentProxy } from "unpdf";
import { ServiceError } from "./types";

const MAX_DOC_BYTES = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXT = /\.(pdf|docx)$/i;
const INCIDENT_MARKER_RE = /INCIDENCIA\s*0*(\d+)/i;

export interface DocumentImage {
  data: Uint8Array;
  mimeType: string;
  filename: string;
}

export interface DocumentContent {
  text: string;
  /** Imágenes agrupadas por índice de incidencia (0-based). */
  imagesByIncident: DocumentImage[][];
}

function isAllowedDocument(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  return ALLOWED_EXT.test(file.name);
}

function incidentIndexFromText(text: string): number | null {
  const match = text.match(INCIDENT_MARKER_RE);
  if (!match) return null;
  return Math.max(0, parseInt(match[1], 10) - 1);
}

function emptyGroups(count: number): DocumentImage[][] {
  return Array.from({ length: Math.max(count, 1) }, () => []);
}

function unpdfImageToPng(img: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  channels: 1 | 3 | 4;
}): Buffer {
  const png = new PNG({ width: img.width, height: img.height });
  if (img.channels === 4) {
    png.data = Buffer.from(img.data);
  } else if (img.channels === 3) {
    const rgba = Buffer.alloc(img.width * img.height * 4);
    for (let i = 0, j = 0; i < img.data.length; i += 3, j += 4) {
      rgba[j] = img.data[i];
      rgba[j + 1] = img.data[i + 1];
      rgba[j + 2] = img.data[i + 2];
      rgba[j + 3] = 255;
    }
    png.data = rgba;
  } else {
    const rgba = Buffer.alloc(img.width * img.height * 4);
    for (let i = 0, j = 0; i < img.data.length; i++, j += 4) {
      const v = img.data[i];
      rgba[j] = v;
      rgba[j + 1] = v;
      rgba[j + 2] = v;
      rgba[j + 3] = 255;
    }
    png.data = rgba;
  }
  return PNG.sync.write(png);
}

function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

function parseDocxRels(relsXml: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(relsXml)) !== null) {
    const target = match[2].replace(/^\.\.\//, "");
    map[match[1]] = target.startsWith("word/") ? target : `word/${target}`;
  }
  return map;
}

async function extractPdfContent(buffer: Buffer, incidentCount: number): Promise<DocumentContent> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text: pageTexts } = await extractText(pdf, { mergePages: false });
  const text = pageTexts.join("\n\n").trim();
  const groups = emptyGroups(incidentCount);
  let currentIncident = 0;

  for (let page = 1; page <= pageTexts.length; page++) {
    const pageText = pageTexts[page - 1] ?? "";
    const markerIndex = incidentIndexFromText(pageText);
    if (markerIndex !== null) currentIncident = markerIndex;

    const target = Math.min(currentIncident, groups.length - 1);
    const pageImages = await extractImages(pdf, page);

    for (let i = 0; i < pageImages.length; i++) {
      const png = unpdfImageToPng(pageImages[i]);
      groups[target].push({
        data: new Uint8Array(png),
        mimeType: "image/png",
        filename: `evidencia-p${page}-${i + 1}.png`,
      });
    }
  }

  return { text, imagesByIncident: groups };
}

async function extractDocxContent(buffer: Buffer, incidentCount: number): Promise<DocumentContent> {
  const [textResult, zip] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    JSZip.loadAsync(buffer),
  ]);

  const text = textResult.value.trim();
  const groups = emptyGroups(incidentCount);
  const docXml = await zip.file("word/document.xml")?.async("string");
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");

  if (!docXml || !relsXml) {
    return { text, imagesByIncident: groups };
  }

  const relMap = parseDocxRels(relsXml);
  let currentIncident = 0;
  const paragraphs = docXml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];

  for (const paragraph of paragraphs) {
    const textNodes = paragraph.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
    const paragraphText = textNodes
      .map((node) => node.replace(/<[^>]+>/g, ""))
      .join("");

    const markerIndex = incidentIndexFromText(paragraphText);
    if (markerIndex !== null) currentIncident = markerIndex;

    const embeds = paragraph.match(/r:embed="(rId\d+)"/g) ?? [];
    for (const embed of embeds) {
      const rId = embed.match(/r:embed="(rId\d+)"/)?.[1];
      if (!rId) continue;

      const mediaPath = relMap[rId];
      if (!mediaPath) continue;

      const mediaFile = zip.file(mediaPath);
      if (!mediaFile) continue;

      const data = await mediaFile.async("uint8array");
      const filename = mediaPath.split("/").pop() ?? `evidencia-${groups.flat().length + 1}.png`;
      const target = Math.min(currentIncident, groups.length - 1);

      groups[target].push({
        data,
        mimeType: mimeFromPath(filename),
        filename,
      });
    }
  }

  return { text, imagesByIncident: groups };
}

/** Convierte una imagen extraída del documento a File para subir a Notion. */
export function documentImageToFile(image: DocumentImage): File {
  const bytes = Buffer.from(image.data);
  return new File([bytes], image.filename, { type: image.mimeType });
}

/**
 * Extrae texto e imágenes de un PDF o DOCX.
 * Las imágenes se agrupan por sección INCIDENCIA 001, 002… detectada en el documento.
 */
export async function extractDocumentContent(
  file: File,
  incidentCount = 1
): Promise<DocumentContent> {
  if (file.size > MAX_DOC_BYTES) {
    throw new ServiceError(`"${file.name}" supera el límite de 15 MB.`, 400);
  }
  if (!isAllowedDocument(file)) {
    throw new ServiceError("Solo se aceptan archivos PDF o DOCX.", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const content = isPdf
    ? await extractPdfContent(buffer, incidentCount)
    : await extractDocxContent(buffer, incidentCount);

  if (!content.text || content.text.length < 40) {
    throw new ServiceError(
      "No se pudo leer texto del documento. Verifica que no esté escaneado como imagen.",
      400
    );
  }

  return content;
}

/** Extrae solo texto (compatibilidad). */
export async function extractDocumentText(file: File): Promise<string> {
  const { text } = await extractDocumentContent(file, 1);
  return text;
}
