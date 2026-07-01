import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import { getNotionClient } from "./notion-client";

/** Límite de bloques hijos por request en Notion (pages.create y blocks.children.append). */
export const NOTION_CHILDREN_BATCH_SIZE = 100;

/** Primer lote para pages.create y el resto para append por lotes. */
export function splitNotionChildren(blocks: BlockObjectRequest[]): {
  initial: BlockObjectRequest[];
  remainder: BlockObjectRequest[];
} {
  return {
    initial: blocks.slice(0, NOTION_CHILDREN_BATCH_SIZE),
    remainder: blocks.slice(NOTION_CHILDREN_BATCH_SIZE),
  };
}

/** Añade bloques a una página existente en lotes de 100. */
export async function appendNotionChildren(
  pageId: string,
  blocks: BlockObjectRequest[]
): Promise<void> {
  if (blocks.length === 0) return;

  const notion = getNotionClient();
  let rest = blocks;

  while (rest.length > 0) {
    const batch = rest.slice(0, NOTION_CHILDREN_BATCH_SIZE);
    await notion.blocks.children.append({
      block_id: pageId,
      children: batch as Parameters<typeof notion.blocks.children.append>[0]["children"],
    });
    rest = rest.slice(NOTION_CHILDREN_BATCH_SIZE);
  }
}
