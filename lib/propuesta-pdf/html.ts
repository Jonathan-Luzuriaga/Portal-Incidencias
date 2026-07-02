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

export function richTextToHtml(richText: NotionRichText[] | undefined): string {
  if (!richText || richText.length === 0) return "";
  return richText
    .map((rt) => {
      const raw = rt.plain_text ?? "";
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

function tableToHtml(block: PropuestaBlock): string {
  const rows = block.__rows ?? [];
  if (rows.length === 0) return "";
  const tableData = block.table as { has_column_header?: boolean } | undefined;
  const hasHeader = tableData?.has_column_header ?? true;

  const renderRow = (cells: NotionRichText[][], tag: "th" | "td") =>
    `<tr>${cells.map((cell) => `<${tag}>${richTextToHtml(cell) || "&nbsp;"}</${tag}>`).join("")}</tr>`;

  let head = "";
  let bodyRows = rows;
  if (hasHeader) {
    head = `<thead>${renderRow(rows[0].cells, "th")}</thead>`;
    bodyRows = rows.slice(1);
  }
  const body = `<tbody>${bodyRows.map((r) => renderRow(r.cells, "td")).join("")}</tbody>`;
  return `<table class="data-table">${head}${body}</table>`;
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
  return SKIP_SECTIONS.has(n) || /^propuesta\b/.test(n);
}

export function blocksToHtml(blocks: PropuestaBlock[], allowSkip = false): string {
  const parts: string[] = [];
  let skipping = false;
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const type = block.type;

    if (allowSkip && skipping) {
      if (type === "divider") skipping = false;
      i++;
      continue;
    }

    if (type === "heading_1" || type === "heading_2" || type === "heading_3") {
      const text = blockPlainText(block);
      if (allowSkip && isSkipHeading(text)) {
        skipping = true;
        i++;
        continue;
      }
      const inner = richTextToHtml(blockRichText(block));
      if (type === "heading_3") {
        parts.push(`<h3 class="subsection-title">${inner}</h3>`);
      } else {
        parts.push(`<h2 class="section-title">${inner}</h2>`);
      }
      i++;
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
      default:
        break;
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
