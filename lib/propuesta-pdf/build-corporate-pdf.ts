/**
 * Pipeline de PDF corporativo: Notion → normalización → plantilla fija (sin DeepSeek HTML).
 */
import { blocksToText } from "@/lib/notion-propuesta-list";
import { buildCorporateContent } from "@/lib/deepseek-propuesta-pdf";
import { computeFinancials } from "./calc";
import { buildCorporateHtml } from "./corporate-template";
import { parseProposalFromBlocks } from "./notion-parser";
import {
  isSparseContent,
  mergeProposalContent,
  standardizeProposalContent,
} from "./propuesta-standardize";
import type { AssetName } from "./assets";
import type { CorporateCover } from "./corporate-types";
import type { PropuestaBlock } from "./html";

/**
 * Genera HTML con la plantilla corporativa fija (794×1122 px, tablas estándar).
 * DeepSeek solo se usa opcionalmente para extraer datos si Notion viene muy incompleto;
 * nunca maqueta el HTML (evita filas/tamaños inconsistentes).
 */
export async function buildStandardCorporatePdfHtml(
  blocks: PropuestaBlock[],
  cover: CorporateCover,
  assets: Record<AssetName, string>
): Promise<string> {
  const parsed = parseProposalFromBlocks(blocks, cover);
  let content = standardizeProposalContent(parsed);

  if (isSparseContent(content)) {
    const rawText = blocksToText(blocks);
    if (rawText.trim()) {
      const extracted = await buildCorporateContent(rawText, cover);
      content = standardizeProposalContent(mergeProposalContent(parsed, extracted));
    }
  }

  const financials = computeFinancials(content.actividades);
  return buildCorporateHtml(content, financials, assets);
}
