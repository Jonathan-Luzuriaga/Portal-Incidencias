import { PROPUESTA_PDF_CSS } from "./styles";

/** Bloque de Notion con hijos/filas ya resueltos (ver notion-propuesta-list). */
export interface PropuestaBlock {
  type: string;
  [key: string]: unknown;
  __children?: PropuestaBlock[];
  __rows?: Array<{ cells: NotionRichText[][] }>;
}

interface NotionRichText {
  plain_text?: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
}

export interface PropuestaCoverData {
  name: string;
  code: string;
  version: string;
  fecha: string;
  validezDias: string | number;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cleanDisplayText(text: string): string {
  return text.replace(/^\\+\s*/, "");
}

export function richTextToHtml(richText: NotionRichText[] | undefined): string {
  if (!richText || richText.length === 0) return "";
  return richText
    .map((rt) => {
      const raw = cleanDisplayText(rt.plain_text ?? "");
      if (!raw) return "";
      let html = escapeHtml(raw);
      const a = rt.annotations ?? {};
      if (a.code) html = `<code>${html}</code>`;
      if (a.bold) html = `<strong>${html}</strong>`;
      if (a.italic) html = `<em>${html}</em>`;
      if (a.underline) html = `<u>${html}</u>`;
      if (a.strikethrough) html = `<s>${html}</s>`;
      if (rt.href) html = `<a href="${escapeHtml(rt.href)}">${html}</a>`;
      return html;
    })
    .join("");
}

function blockRichText(block: PropuestaBlock): NotionRichText[] {
  const data = block[block.type] as { rich_text?: NotionRichText[] } | undefined;
  return data?.rich_text ?? [];
}

function blockPlainText(block: PropuestaBlock): string {
  return blockRichText(block)
    .map((rt) => rt.plain_text ?? "")
    .join("")
    .trim();
}

function cellPlainText(cell: NotionRichText[]): string {
  return cell.map((rt) => rt.plain_text ?? "").join("").trim();
}

function isPriceTableRows(rows: Array<{ cells: NotionRichText[][] }>): boolean {
  const flat = rows.flatMap((r) => r.cells.map((c) => cellPlainText(c as NotionRichText[])));
  const joined = flat.join(" ").toLowerCase();
  return (
    (/precio|subtotal|i\.?\s*v\.?\s*a\.?|total/.test(joined) || joined.includes("$")) &&
    rows.length <= 14
  );
}

function tableExtraClasses(rows: Array<{ cells: NotionRichText[][] }>): string {
  const classes = ["data-table"];
  if (isPriceTableRows(rows)) classes.push("price-table", "table-keep-together");
  else if (rows.length <= 8) classes.push("table-keep-together");
  return classes.join(" ");
}

/** Filas de cierre financiero (Subtotal / I.V.A. / Total) para agrupar en tfoot. */
function isFinancialSummaryRow(cells: NotionRichText[][]): boolean {
  const label = cellPlainText(cells[0] ?? [])
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (label === "subtotal") return true;
  if (/^i\.?\s*v\.?\s*a\.?$/.test(label)) return true;
  return label === "total";
}

function looksLikeHeaderRow(cells: NotionRichText[][]): boolean {
  const joined = cells.map((c) => cellPlainText(c)).join(" ").toLowerCase();
  return /descripción|descripcion|precio|rol|cantidad|etapa|actividad|tiempo|módulo|modulo|#/.test(
    joined
  );
}

const FIELD_LABELS = new Set([
  "rol",
  "necesidad",
  "beneficio esperado",
  "alcance considerado",
  "criterios de aceptacion principales",
  "criterios de aceptacion",
]);

function isHuHeading(text: string): boolean {
  return /^HU\s*\d+/i.test(text.trim());
}

function isHeadingBlock(block: PropuestaBlock): boolean {
  return block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3";
}

/** Párrafo etiqueta (p. ej. «Beneficio esperado:») que debe ir con el bloque siguiente. */
function isFieldLabelBlock(block: PropuestaBlock): boolean {
  if (block.type !== "paragraph") return false;
  const plain = blockPlainText(block);
  if (!plain.endsWith(":") || plain.length > 100) return false;
  const label = normalize(plain.replace(/:$/, ""));
  if (FIELD_LABELS.has(label)) return true;
  return plain.length <= 60 && /^[A-Za-zÁÉÍÓÚáéíóúÑñüÜ0-9\s().–-]+:$/.test(plain);
}

function sliceHasLongContent(blocks: PropuestaBlock[]): boolean {
  let paragraphs = 0;
  let listItems = 0;
  for (const block of blocks) {
    if (block.type === "paragraph") paragraphs++;
    if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") listItems++;
  }
  return paragraphs > 2 || listItems > 5;
}

function tableToHtml(block: PropuestaBlock): string {
  const rows = block.__rows ?? [];
  if (rows.length === 0) return "";
  const tableData = block.table as { has_column_header?: boolean } | undefined;
  let hasHeader = tableData?.has_column_header ?? true;
  if (!hasHeader && rows.length > 1 && looksLikeHeaderRow(rows[0].cells)) {
    hasHeader = true;
  }

  const renderRow = (cells: NotionRichText[][], tag: "th" | "td") =>
    `<tr>${cells.map((cell) => `<${tag}>${richTextToHtml(cell) || "&nbsp;"}</${tag}>`).join("")}</tr>`;

  let head = "";
  let bodyRows = rows;
  if (hasHeader) {
    head = `<thead>${renderRow(rows[0].cells, "th")}</thead>`;
    bodyRows = rows.slice(1);
  }

  const isPriceTable = isPriceTableRows(rows);
  let dataRows = bodyRows;
  let footerRows: typeof bodyRows = [];
  if (isPriceTable) {
    const splitAt = bodyRows.findIndex((r) => isFinancialSummaryRow(r.cells));
    if (splitAt >= 0) {
      dataRows = bodyRows.slice(0, splitAt);
      footerRows = bodyRows.slice(splitAt);
    }
  }

  const body = `<tbody>${dataRows.map((r) => renderRow(r.cells, "td")).join("")}</tbody>`;
  const foot =
    footerRows.length > 0
      ? `<tfoot>${footerRows.map((r) => renderRow(r.cells, "td")).join("")}</tfoot>`
      : "";
  const className = tableExtraClasses(rows);
  const tableHtml = `<table class="${className}">${head}${body}${foot}</table>`;

  if (isPriceTable) return `<div class="price-table-wrap">${tableHtml}</div>`;
  if (rows.length <= 8) return `<div class="table-wrap-keep">${tableHtml}</div>`;
  return tableHtml;
}

const LIST_TYPES = new Set(["bulleted_list_item", "numbered_list_item"]);

function listItemsToHtml(items: PropuestaBlock[]): string {
  return items
    .map((item) => {
      const inner = richTextToHtml(blockRichText(item));
      const children = item.__children && item.__children.length > 0 ? blocksToHtml(item.__children) : "";
      return `<li>${inner}${children}</li>`;
    })
    .join("");
}

/** Secciones de cabecera que ya se representan en la portada y deben omitirse. */
const SKIP_SECTIONS = new Set(["metadatos de la propuesta", "manticore labs", "indice"]);

function isSkipHeading(text: string): boolean {
  const n = normalize(text);
  return SKIP_SECTIONS.has(n) || /^propuesta\b/.test(n) || n.includes("propuesta tecnica");
}

export function blocksToHtml(blocks: PropuestaBlock[], allowSkip = false): string {
  const parts: string[] = [];
  let skipping = false;
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const type = block.type;

    if (allowSkip && skipping) {
      if (type === "divider") {
        skipping = false;
        i++;
        continue;
      }
      const isHeading = type === "heading_1" || type === "heading_2" || type === "heading_3";
      if (isHeading && !isSkipHeading(blockPlainText(block))) {
        skipping = false;
      } else {
        i++;
        continue;
      }
    }

    if (type === "heading_1" || type === "heading_2" || type === "heading_3") {
      const text = blockPlainText(block);
      if (allowSkip && isSkipHeading(text)) {
        skipping = true;
        i++;
        continue;
      }
      const inner = richTextToHtml(blockRichText(block));
      const huClass = isHuHeading(text) ? " hu-title" : "";
      if (type === "heading_3") {
        parts.push(`<h3 class="subsection-title${huClass}">${inner}</h3>`);
      } else {
        parts.push(`<h2 class="section-title${huClass}">${inner}</h2>`);
      }
      i++;
      continue;
    }

    if (isFieldLabelBlock(block)) {
      const labelInner = richTextToHtml(blockRichText(block));
      let j = i + 1;
      while (j < blocks.length) {
        const next = blocks[j];
        if (
          isFieldLabelBlock(next) ||
          isHeadingBlock(next) ||
          next.type === "divider" ||
          next.type === "table"
        ) {
          break;
        }
        j++;
      }
      const contentBlocks = blocks.slice(i + 1, j);
      const contentHtml = contentBlocks.length > 0 ? blocksToHtml(contentBlocks, false) : "";
      const loose = sliceHasLongContent(contentBlocks) ? " field-block-loose" : "";
      parts.push(
        `<div class="field-block${loose}"><p class="field-label">${labelInner}</p>${contentHtml}</div>`
      );
      i = j;
      continue;
    }

    if (LIST_TYPES.has(type)) {
      const tag = type === "numbered_list_item" ? "ol" : "ul";
      const items: PropuestaBlock[] = [];
      while (i < blocks.length && blocks[i].type === type) {
        items.push(blocks[i]);
        i++;
      }
      parts.push(`<${tag}>${listItemsToHtml(items)}</${tag}>`);
      continue;
    }

    switch (type) {
      case "paragraph": {
        const inner = richTextToHtml(blockRichText(block));
        if (inner.trim()) parts.push(`<p>${inner}</p>`);
        break;
      }
      case "quote":
      case "callout": {
        const inner = richTextToHtml(blockRichText(block));
        if (inner.trim()) parts.push(`<blockquote>${inner}</blockquote>`);
        break;
      }
      case "table":
        parts.push(tableToHtml(block));
        break;
      case "divider":
        parts.push(`<hr class="section-divider" />`);
        break;
      case "toggle": {
        const inner = richTextToHtml(blockRichText(block));
        if (inner.trim()) parts.push(`<p><strong>${inner}</strong></p>`);
        if (block.__children) parts.push(blocksToHtml(block.__children));
        break;
      }
      case "to_do": {
        const data = block.to_do as { checked?: boolean; rich_text?: NotionRichText[] };
        const mark = data.checked ? "☑ " : "☐ ";
        const inner = richTextToHtml(data.rich_text);
        if (inner.trim()) parts.push(`<p>${mark}${inner}</p>`);
        if (block.__children) parts.push(blocksToHtml(block.__children));
        break;
      }
      default: {
        const inner = richTextToHtml(blockRichText(block));
        if (inner.trim()) parts.push(`<p>${inner}</p>`);
        else {
          const plain = blockPlainText(block);
          if (plain) parts.push(`<p>${escapeHtml(plain)}</p>`);
        }
        if (block.__children?.length) parts.push(blocksToHtml(block.__children));
        break;
      }
    }
    i++;
  }

  return parts.join("\n");
}

function coverHtml(cover: PropuestaCoverData): string {
  const name = escapeHtml(cover.name || "Propuesta");
  const code = escapeHtml(cover.code || "");
  const version = escapeHtml(cover.version || "1.0.0");
  const fecha = escapeHtml(cover.fecha || "");
  const validez = escapeHtml(String(cover.validezDias ?? "45"));

  return `
  <section class="page-cover">
    <p class="cover-brand">MANTICORE LABS</p>
    <h1 class="cover-title">Propuesta &ldquo;${name}&rdquo;</h1>
    <div class="cover-meta">
      ${code ? `<div class="cover-meta-group"><span class="cover-label">Número referencial:</span><span class="cover-value">${code}</span></div>` : ""}
      <div class="cover-meta-group"><span class="cover-label">Versión:</span><span class="cover-value">${version}</span></div>
    </div>
    <div class="cover-contact">
      <p class="cover-contact-title">CONTACTANOS:</p>
      <p><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a></p>
      ${fecha ? `<p class="cover-date">${fecha}</p>` : ""}
      <p class="cover-validity">Válido por ${validez} días</p>
    </div>
  </section>`;
}

/** Documento HTML completo listo para renderizar a PDF. */
export function buildProposalHtml(cover: PropuestaCoverData, blocks: PropuestaBlock[]): string {
  const contentHtml = blocksToHtml(blocks, true);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Propuesta ${escapeHtml(cover.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>${PROPUESTA_PDF_CSS}</style>
</head>
<body>
  ${coverHtml(cover)}
  <section class="content">
    ${contentHtml}
  </section>
</body>
</html>`;
}
