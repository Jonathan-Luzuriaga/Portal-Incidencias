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
const INCIDENT_MARKER_RE = /INCIDENCIA\s*#?\s*0*(\d+)/gi;

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

type OrderedItem =
  | { pos: number; kind: "marker" }
  | { pos: number; kind: "image"; image: DocumentImage };

function isAllowedDocument(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  return ALLOWED_EXT.test(file.name);
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

/** Reparte imágenes en orden entre varias secciones (ej. varias INCIDENCIA en la misma página). */
function splitImagesAcrossSections(
  images: DocumentImage[],
  startSection: number,
  sectionCount: number,
  incidentCount: number
): Map<number, DocumentImage[]> {
  const buckets = new Map<number, DocumentImage[]>();
  if (images.length === 0 || sectionCount <= 0) return buckets;

  const maxSection = incidentCount - 1;
  for (let i = 0; i < images.length; i++) {
    const section = Math.min(startSection + (i % sectionCount), maxSection);
    const list = buckets.get(section) ?? [];
    list.push(images[i]);
    buckets.set(section, list);
  }
  return buckets;
}

function pushToGroup(groups: DocumentImage[][], index: number, image: DocumentImage) {
  const target = Math.min(Math.max(0, index), groups.length - 1);
  groups[target].push(image);
}

/**
 * Asigna imágenes según el orden de aparición de marcadores INCIDENCIA en el documento.
 * Usa índice secuencial (1.ª INCIDENCIA → tarea 0, 2.ª → tarea 1…).
 */
function assignImagesFromOrderedItems(
  items: OrderedItem[],
  incidentCount: number
): DocumentImage[][] {
  const groups = emptyGroups(incidentCount);
  let currentSection = -1;

  for (const item of items.sort((a, b) => a.pos - b.pos)) {
    if (item.kind === "marker") {
      currentSection++;
      continue;
    }
    const target = currentSection < 0 ? 0 : Math.min(currentSection, incidentCount - 1);
    pushToGroup(groups, target, item.image);
  }

  return balanceSingleBucket(groups, incidentCount);
}

/**
 * Si todas las imágenes quedaron en la primera tarea pero hay varias incidencias,
 * reparte en orden (2 capturas × N tareas → N buckets con 2 cada una).
 */
function balanceSingleBucket(groups: DocumentImage[][], incidentCount: number): DocumentImage[][] {
  if (incidentCount <= 1) return groups;

  const total = groups.reduce((sum, group) => sum + group.length, 0);
  if (total === 0) return groups;

  const nonEmpty = groups.filter((group) => group.length > 0).length;
  if (nonEmpty > 1) return groups;

  const all = groups.flat();
  if (all.length < incidentCount) return groups;

  const perIncident = Math.floor(all.length / incidentCount);
  if (perIncident === 0) return groups;

  const balanced = emptyGroups(incidentCount);
  let offset = 0;
  for (let i = 0; i < incidentCount; i++) {
    const extra = i < all.length % incidentCount ? 1 : 0;
    const count = perIncident + extra;
    balanced[i] = all.slice(offset, offset + count);
    offset += count;
  }
  return balanced;
}

async function loadDocxImage(
  rId: string,
  relMap: Record<string, string>,
  zip: JSZip
): Promise<DocumentImage | null> {
  const mediaPath = relMap[rId];
  if (!mediaPath) return null;

  const mediaFile = zip.file(mediaPath);
  if (!mediaFile) return null;

  const data = await mediaFile.async("uint8array");
  const filename = mediaPath.split("/").pop() ?? `evidencia-${rId}.png`;
  return { data, mimeType: mimeFromPath(filename), filename };
}

async function extractPdfContent(buffer: Buffer, incidentCount: number): Promise<DocumentContent> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text: pageTexts } = await extractText(pdf, { mergePages: false });
  const text = pageTexts.join("\n\n").trim();
  const groups = emptyGroups(incidentCount);
  let currentSection = -1;

  for (let page = 1; page <= pageTexts.length; page++) {
    const pageText = pageTexts[page - 1] ?? "";
    const markersOnPage = [...pageText.matchAll(INCIDENT_MARKER_RE)];
    const pageImages = await extractImages(pdf, page);
    const converted: DocumentImage[] = [];

    for (let i = 0; i < pageImages.length; i++) {
      const png = unpdfImageToPng(pageImages[i]);
      converted.push({
        data: new Uint8Array(png),
        mimeType: "image/png",
        filename: `evidencia-p${page}-${i + 1}.png`,
      });
    }

    if (converted.length === 0) {
      currentSection += markersOnPage.length;
      continue;
    }

    if (markersOnPage.length === 0) {
      const target = currentSection < 0 ? 0 : Math.min(currentSection, incidentCount - 1);
      for (const image of converted) pushToGroup(groups, target, image);
      continue;
    }

    const startSection = currentSection + 1;
    currentSection += markersOnPage.length;
    const buckets = splitImagesAcrossSections(
      converted,
      startSection,
      markersOnPage.length,
      incidentCount
    );

    for (const [section, images] of buckets) {
      for (const image of images) pushToGroup(groups, section, image);
    }
  }

  return { text, imagesByIncident: balanceSingleBucket(groups, incidentCount) };
}

async function extractDocxContent(buffer: Buffer, incidentCount: number): Promise<DocumentContent> {
  const [textResult, zip] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    JSZip.loadAsync(buffer),
  ]);

  const text = textResult.value.trim();
  const docXml = await zip.file("word/document.xml")?.async("string");
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");

  if (!docXml || !relsXml) {
    return { text, imagesByIncident: emptyGroups(incidentCount) };
  }

  const relMap = parseDocxRels(relsXml);
  const ordered: OrderedItem[] = [];

  for (const match of docXml.matchAll(INCIDENT_MARKER_RE)) {
    if (match.index !== undefined) ordered.push({ pos: match.index, kind: "marker" });
  }

  const embedMatches = [...docXml.matchAll(/r:embed="(rId\d+)"/g)];
  for (const match of embedMatches) {
    if (match.index === undefined) continue;
    const rId = match[1];
    const image = await loadDocxImage(rId, relMap, zip);
    if (image) ordered.push({ pos: match.index, kind: "image", image });
  }

  return {
    text,
    imagesByIncident: assignImagesFromOrderedItems(ordered, incidentCount),
  };
}

/** Convierte una imagen extraída del documento a File para subir a Notion. */
export function documentImageToFile(image: DocumentImage): File {
  const bytes = Buffer.from(image.data);
  return new File([bytes], image.filename, { type: image.mimeType });
}

/**
 * Extrae texto e imágenes de un PDF o DOCX.
 * Las imágenes se agrupan por sección INCIDENCIA 001, 002… en orden de aparición.
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
