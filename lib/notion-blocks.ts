import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";

const NOTION_TEXT_LIMIT = 2000;

type RichText = {
  type: "text";
  text: { content: string; link?: { url: string } | null };
  annotations?: { bold?: boolean };
};

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > NOTION_TEXT_LIMIT) {
    chunks.push(rest.slice(0, NOTION_TEXT_LIMIT));
    rest = rest.slice(NOTION_TEXT_LIMIT);
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

function pushRich(
  arr: RichText[],
  content: string,
  opts: { bold?: boolean; link?: string } = {}
): void {
  for (const chunk of chunkText(content)) {
    if (!chunk) continue;
    arr.push({
      type: "text",
      text: { content: chunk, ...(opts.link ? { link: { url: opts.link } } : {}) },
      ...(opts.bold ? { annotations: { bold: true } } : {}),
    });
  }
}

/** Convierte texto con **negritas** y [enlaces](url) en rich_text de Notion. */
function parseRichText(text: string): RichText[] {
  const result: RichText[] = [];
  const regex = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) pushRich(result, text.slice(last, m.index));
    if (m[1] !== undefined) pushRich(result, m[1], { bold: true });
    else if (m[2] !== undefined) pushRich(result, m[2], { link: m[3] });
    last = regex.lastIndex;
  }
  if (last < text.length) pushRich(result, text.slice(last));
  if (result.length === 0) pushRich(result, text || " ");
  return result;
}

function paragraphBlock(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: parseRichText(text) },
  } as BlockObjectRequest;
}

function headingBlock(level: 1 | 2 | 3, text: string): BlockObjectRequest {
  const key = level === 1 ? "heading_1" : level === 2 ? "heading_2" : "heading_3";
  return {
    object: "block",
    type: key,
    [key]: { rich_text: parseRichText(text.slice(0, NOTION_TEXT_LIMIT)) },
  } as BlockObjectRequest;
}

function listItemBlock(text: string, numbered: boolean): BlockObjectRequest {
  const type = numbered ? "numbered_list_item" : "bulleted_list_item";
  return {
    object: "block",
    type,
    [type]: { rich_text: parseRichText(text) },
  } as BlockObjectRequest;
}

function quoteBlock(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "quote",
    quote: { rich_text: parseRichText(text || " ") },
  } as BlockObjectRequest;
}

function dividerBlock(): BlockObjectRequest {
  return { object: "block", type: "divider", divider: {} } as BlockObjectRequest;
}

function parseTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  const s = line.trim();
  if (!s.includes("-")) return false;
  return s.replace(/[|\-:\s]/g, "") === "";
}

function tableBlock(rows: string[][]): BlockObjectRequest {
  const width = Math.max(...rows.map((r) => r.length));
  const normalized = rows.map((r) => {
    const cells = r.slice(0, width);
    while (cells.length < width) cells.push("");
    return cells;
  });

  return {
    object: "block",
    type: "table",
    table: {
      table_width: width,
      has_column_header: true,
      has_row_header: false,
      children: normalized.map((cells) => ({
        object: "block",
        type: "table_row",
        table_row: { cells: cells.map((c) => parseRichText(c)) },
      })),
    },
  } as BlockObjectRequest;
}

/**
 * Convierte markdown en bloques de Notion.
 * Soporta headings (#/##/###), tablas, listas (- / 1.), citas (>),
 * divisores (---), negritas (**) y enlaces ([texto](url)).
 */
export function markdownToNotionBlocks(markdown: string): BlockObjectRequest[] {
  const lines = markdown.split("\n");
  const blocks: BlockObjectRequest[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Divisor horizontal
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(dividerBlock());
      i++;
      continue;
    }

    // Tabla markdown
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        tableLines.push(lines[j]);
        j++;
      }
      if (tableLines.length >= 2 && isTableSeparator(tableLines[1])) {
        const header = parseTableRow(tableLines[0]);
        const bodyRows = tableLines.slice(2).map(parseTableRow);
        blocks.push(tableBlock([header, ...bodyRows]));
        i = j;
        continue;
      }
    }

    // Headings
    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      blocks.push(headingBlock(3, h3[1]));
      i++;
      continue;
    }
    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      blocks.push(headingBlock(2, h2[1]));
      i++;
      continue;
    }
    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      blocks.push(headingBlock(1, h1[1]));
      i++;
      continue;
    }

    // Cita (multilínea)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const q = lines[i].trim();
        if (!q.startsWith(">")) break;
        const content = q.replace(/^>\s?/, "");
        if (content) quoteLines.push(content);
        i++;
      }
      blocks.push(quoteBlock(quoteLines.join("\n")));
      continue;
    }

    // Lista con viñetas (incluye indentadas)
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    if (bullet) {
      blocks.push(listItemBlock(bullet[1], false));
      i++;
      continue;
    }

    // Lista numerada
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      blocks.push(listItemBlock(numbered[1], true));
      i++;
      continue;
    }

    // Párrafo (une líneas consecutivas normales)
    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      const nextLine = lines[i];
      if (
        !next ||
        next.startsWith("#") ||
        next.startsWith("|") ||
        next.startsWith(">") ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(next) ||
        /^\s*[-*•]\s/.test(nextLine) ||
        /^\d+[.)]\s/.test(next)
      ) {
        break;
      }
      paraLines.push(next);
      i++;
    }
    blocks.push(paragraphBlock(paraLines.join("\n")));
  }

  return blocks.length > 0 ? blocks : [paragraphBlock("(Sin contenido)")];
}

/** Bloques de imagen usando file_upload IDs de Notion. */
export function evidenceImageBlocks(fileUploadIds: string[]): BlockObjectRequest[] {
  if (fileUploadIds.length === 0) return [];

  const blocks: BlockObjectRequest[] = [headingBlock(3, "Evidencias")];

  for (const id of fileUploadIds) {
    blocks.push({
      object: "block",
      type: "image",
      image: {
        type: "file_upload",
        file_upload: { id },
      },
    });
  }

  return blocks;
}
