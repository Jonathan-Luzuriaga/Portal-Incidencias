import { getNotionClient } from "./notion-client";
import { getNotionConfig } from "./notion-config";
import { getPropuestaConfig } from "./propuesta-config";
import type { PropuestaBlock, PropuestaCoverData } from "./propuesta-pdf/html";
import { ServiceError } from "./types";

export interface PropuestaListItem {
  id: string;
  title: string;
  code: string;
  createdTime: string | null;
}

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatSpanishDate(date: Date): string {
  return `${date.getDate()} de ${MONTHS_ES[date.getMonth()]} del ${date.getFullYear()}`;
}

/** Fecha en español para portada del PDF (día de generación). */
export function formatPropuestaPdfDate(date: Date = new Date()): string {
  return formatSpanishDate(date);
}

let cachedTasksDataSourceId: string | null = null;

async function getTasksDataSourceId(): Promise<string> {
  if (cachedTasksDataSourceId) return cachedTasksDataSourceId;
  const config = getNotionConfig();
  const notion = getNotionClient();
  const db = await notion.request<{ data_sources: Array<{ id: string }> }>({
    path: `databases/${config.databaseId}`,
    method: "get",
  });
  const dsId = db.data_sources?.[0]?.id;
  if (!dsId) {
    throw new ServiceError(`No se encontró data source para la BD ${config.databaseId}.`, 502);
  }
  cachedTasksDataSourceId = dsId;
  return dsId;
}

function extractPageTitle(properties: Record<string, unknown>, titleProp: string): string {
  const prop = properties[titleProp] as { title?: Array<{ plain_text?: string }> } | undefined;
  return prop?.title?.map((t) => t.plain_text ?? "").join("").trim() ?? "";
}

function extractCode(title: string): string {
  const match = title.match(/PS[-\s]?\d{4}[-\s]?\d{3,4}[-\s]?\d{1,2}/i);
  return match ? match[0].replace(/\s+/g, "-").toUpperCase() : "";
}

function cleanName(title: string): string {
  return title
    .replace(/^propuesta\s*[—-]\s*/i, "")
    .replace(/PS[-\s]?\d{4}[-\s]?\d{3,4}[-\s]?\d{1,2}/i, "")
    .replace(/["“”]/g, "")
    .trim();
}

/** Lista las propuestas (tareas con categoría "Propuesta") de Notion. */
export async function listPropuestas(): Promise<PropuestaListItem[]> {
  const config = getNotionConfig();
  const propuesta = getPropuestaConfig();
  const categoryValue = propuesta.categoria[0] ?? "Propuesta";

  try {
    const dsId = await getTasksDataSourceId();
    const notion = getNotionClient();
    const results: Array<{
      id: string;
      created_time?: string;
      properties: Record<string, unknown>;
    }> = [];

    let cursor: string | undefined;
    let pages = 0;
    do {
      const response = await notion.request<{
        results: Array<{ id: string; created_time?: string; properties: Record<string, unknown> }>;
        has_more: boolean;
        next_cursor: string | null;
      }>({
        path: `data_sources/${dsId}/query`,
        method: "post",
        body: {
          filter: {
            property: config.props.category,
            multi_select: { contains: categoryValue },
          },
          sorts: [{ timestamp: "created_time", direction: "descending" }],
          start_cursor: cursor,
          page_size: 100,
        },
      });
      results.push(...response.results);
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
      pages++;
    } while (cursor && pages < 20);

    return results
      .map((page) => {
        const title = extractPageTitle(page.properties, config.props.title);
        return {
          id: page.id,
          title: title || "Propuesta sin título",
          code: extractCode(title),
          createdTime: page.created_time ?? null,
        };
      })
      .filter((p) => p.title);
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    const message = err instanceof Error ? err.message : "Error desconocido.";
    throw new ServiceError(`No se pudieron listar las propuestas. ${message}`, 502);
  }
}

interface RawBlock {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

async function fetchChildren(blockId: string): Promise<RawBlock[]> {
  const notion = getNotionClient();
  const blocks: RawBlock[] = [];
  let cursor: string | undefined;
  do {
    const response = (await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    })) as unknown as {
      results: RawBlock[];
      has_more: boolean;
      next_cursor: string | null;
    };
    blocks.push(...response.results);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return blocks;
}

async function resolveBlocks(blockId: string, depth: number): Promise<PropuestaBlock[]> {
  const raw = await fetchChildren(blockId);

  return Promise.all(
    raw.map(async (block) => {
      const item = block as unknown as PropuestaBlock;

      if (block.type === "table" && block.has_children) {
        const rows = await fetchChildren(block.id);
        item.__rows = rows
          .filter((r) => r.type === "table_row")
          .map((r) => ({ cells: (r.table_row as { cells: unknown[][] }).cells as never }));
      } else if (block.has_children && depth < 8) {
        item.__children = await resolveBlocks(block.id, depth + 1);
      }

      return item;
    })
  );
}

function findCoverFromMetadata(blocks: PropuestaBlock[]): Partial<PropuestaCoverData> {
  const meta: Partial<PropuestaCoverData> = {};
  for (const block of blocks) {
    if (block.type !== "table" || !block.__rows) continue;
    let matched = false;
    for (const row of block.__rows) {
      const key = (row.cells[0] ?? [])
        .map((rt) => (rt as { plain_text?: string }).plain_text ?? "")
        .join("")
        .trim()
        .toLowerCase();
      const value = (row.cells[1] ?? [])
        .map((rt) => (rt as { plain_text?: string }).plain_text ?? "")
        .join("")
        .trim();
      if (!key || !value) continue;
      if (key.includes("nombre_propuesta") || key === "nombre propuesta") {
        meta.name = value.replace(/^propuesta\s*/i, "").replace(/["“”]/g, "").trim();
        matched = true;
      } else if (key.includes("codigo_propuesta") || key.includes("número referencial") || key.includes("numero referencial")) {
        meta.code = value;
        matched = true;
      } else if (key.includes("version") || key.includes("versión")) {
        meta.version = value;
        matched = true;
      } else if (key.includes("fecha")) {
        meta.fecha = value;
        matched = true;
      } else if (key.includes("validez") || key.includes("válido")) {
        meta.validezDias = value.replace(/[^0-9]/g, "") || value;
        matched = true;
      }
    }
    if (matched) break;
  }
  return meta;
}

export interface PropuestaContent {
  /** Título completo de la página en Notion (propiedad title). */
  title: string;
  cover: PropuestaCoverData;
  blocks: PropuestaBlock[];
}

function richTextToPlain(rich: unknown): string {
  if (!Array.isArray(rich)) return "";
  return rich.map((rt) => (rt as { plain_text?: string }).plain_text ?? "").join("");
}

/** Convierte los bloques resueltos de Notion a texto plano (markdown ligero) para la IA. */
export function blocksToText(blocks: PropuestaBlock[], depth = 0): string {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  for (const block of blocks) {
    const type = block.type;
    const data = (block as Record<string, unknown>)[type] as { rich_text?: unknown } | undefined;
    const text = richTextToPlain(data?.rich_text);

    switch (type) {
      case "heading_1":
        lines.push(`\n# ${text}`);
        break;
      case "heading_2":
        lines.push(`\n## ${text}`);
        break;
      case "heading_3":
        lines.push(`\n### ${text}`);
        break;
      case "bulleted_list_item":
      case "numbered_list_item":
      case "to_do":
        if (text) lines.push(`${indent}- ${text}`);
        break;
      case "quote":
      case "callout":
        if (text) lines.push(`> ${text}`);
        break;
      case "divider":
        lines.push("---");
        break;
      case "table": {
        for (const row of block.__rows ?? []) {
          const cells = row.cells.map((c) => richTextToPlain(c).trim());
          lines.push(`| ${cells.join(" | ")} |`);
        }
        break;
      }
      default:
        if (text) lines.push(text);
        break;
    }

    if (block.__children && block.__children.length > 0) {
      lines.push(blocksToText(block.__children, depth + 1));
    }
  }

  return lines.join("\n");
}

/** Recupera el contenido y metadatos de una propuesta para generar el PDF. */
export async function getPropuestaContent(pageId: string): Promise<PropuestaContent> {
  const config = getNotionConfig();
  const propuesta = getPropuestaConfig();
  const notion = getNotionClient();

  let title = "";
  try {
    const page = (await notion.pages.retrieve({ page_id: pageId })) as unknown as {
      properties: Record<string, unknown>;
    };
    title = extractPageTitle(page.properties, config.props.title);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    throw new ServiceError(`No se pudo abrir la propuesta en Notion. ${message}`, 502);
  }

  const blocks = await resolveBlocks(pageId, 0);
  const fromMeta = findCoverFromMetadata(blocks);

  const cover: PropuestaCoverData = {
    name: fromMeta.name || cleanName(title) || "Propuesta",
    code: fromMeta.code || extractCode(title),
    version: fromMeta.version || "1.0.0",
    fecha: fromMeta.fecha || formatSpanishDate(new Date()),
    validezDias: fromMeta.validezDias ?? 45,
  };

  return { title, cover, blocks };
}
