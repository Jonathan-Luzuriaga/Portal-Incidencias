import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";

const NOTION_TEXT_LIMIT = 2000;

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

function paragraphBlock(text: string): BlockObjectRequest[] {
  return chunkText(text).map((chunk) => ({
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: { rich_text: [{ type: "text" as const, text: { content: chunk } }] },
  }));
}

function headingBlock(level: 2 | 3, text: string): BlockObjectRequest {
  const key = level === 2 ? "heading_2" : "heading_3";
  return {
    object: "block",
    type: key,
    [key]: { rich_text: [{ type: "text", text: { content: text.slice(0, NOTION_TEXT_LIMIT) } }] },
  } as BlockObjectRequest;
}

function listItemBlock(text: string, numbered: boolean): BlockObjectRequest[] {
  const type = numbered ? "numbered_list_item" : "bulleted_list_item";
  return chunkText(text).map((chunk, i) => ({
    object: "block" as const,
    type,
    [type]: {
      rich_text: [{ type: "text" as const, text: { content: chunk } }],
      ...(numbered && i > 0 ? {} : {}),
    },
  })) as BlockObjectRequest[];
}

/**
 * Convierte el markdown generado por DeepSeek en bloques de Notion.
 * Soporta headings (##/###), listas (- / 1.) y párrafos.
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

    // Bulleted list
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      blocks.push(...listItemBlock(bullet[1], false));
      i++;
      continue;
    }

    // Numbered list (1. 2. etc.)
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      blocks.push(...listItemBlock(numbered[1], true));
      i++;
      continue;
    }

    // Regular paragraph (merge consecutive non-special lines)
    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next || next.startsWith("#") || /^[-*•]\s/.test(next) || /^\d+[.)]\s/.test(next)) break;
      paraLines.push(next);
      i++;
    }
    blocks.push(...paragraphBlock(paraLines.join("\n")));
  }

  return blocks.length > 0 ? blocks : paragraphBlock("(Sin contenido)");
}

/** Bloques de imagen usando file_upload IDs de Notion. */
export function evidenceImageBlocks(fileUploadIds: string[]): BlockObjectRequest[] {
  if (fileUploadIds.length === 0) return [];

  const blocks: BlockObjectRequest[] = [
    headingBlock(3, "Evidencias"),
  ];

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
