import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import { parseDocumentIncidents } from "./document-transcription";
import {
  captionedEvidenceImageBlocks,
  documentFileBlocks,
  markdownToNotionBlocks,
} from "./notion-blocks";

export interface DocumentParentSectionBlocks {
  number: string;
  imageUploadIds: string[];
  evidenceCaptions: string[];
}

/** Bloques Notion del ticket padre: resumen + transcripción formateada + imágenes por incidencia. */
export function buildDocumentParentNotionBlocks(args: {
  aiSummary: string;
  documentText: string;
  fileName?: string;
  sections: DocumentParentSectionBlocks[];
  documentUploadIds: string[];
}): BlockObjectRequest[] {
  const parsed = parseDocumentIncidents(args.documentText);
  const blocks: BlockObjectRequest[] = [
    ...markdownToNotionBlocks(`## Resumen\n\n${args.aiSummary.trim()}`),
    ...markdownToNotionBlocks(
      [
        "## Transcripción del documento",
        "",
        args.fileName ? `**Archivo origen:** ${args.fileName}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    ),
  ];

  for (let i = 0; i < parsed.length; i++) {
    const section = parsed[i];
    const uploadMeta = args.sections[i];
    blocks.push(...markdownToNotionBlocks(section.markdown));

    const imageIds = uploadMeta?.imageUploadIds ?? [];
    const captions =
      uploadMeta?.evidenceCaptions?.length
        ? uploadMeta.evidenceCaptions
        : section.evidenceCaptions;

    blocks.push(...captionedEvidenceImageBlocks(captions, imageIds));
  }

  blocks.push(...documentFileBlocks(args.documentUploadIds));
  return blocks;
}
