/**
 * Plantilla corporativa LITERAL: portada con branding Manticore + contenido
 * tal cual esta en Notion, sin reestructurar ni inventar secciones.
 *
 * Usa blocksToHtml() de html.ts para renderizar los bloques de Notion a HTML
 * de forma fiel, y los envuelve en CSS corporativo con la portada de marca.
 */
import { CORPORATE_CSS } from "./corporate-css";
import { blocksToHtml, type PropuestaBlock } from "./html";
import type { CorporateCover } from "./corporate-types";
import type { AssetName } from "./assets";

function esc(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LITERAL_CONTENT_CSS = `
.literal-body {
  padding: 54px 60px 36px 60px;
  font-family: "Open Sans", Arial, Helvetica, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text);
}

.literal-body h2.section-title {
  margin: 28px 0 14px;
  color: var(--deep-gold);
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 15px;
  font-weight: 700;
  break-after: avoid;
  page-break-after: avoid;
}

.literal-body h3.subsection-title {
  margin: 20px 0 10px;
  color: #000000;
  font-size: 13px;
  font-weight: 700;
  break-after: avoid;
  page-break-after: avoid;
}

.literal-body p {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.55;
  text-align: justify;
  text-justify: inter-word;
}

.literal-body ul, .literal-body ol {
  margin: 0 0 12px;
  padding-left: 24px;
}

.literal-body li {
  margin-bottom: 5px;
  font-size: 13px;
  line-height: 1.5;
}

.literal-body li > ul, .literal-body li > ol {
  margin-top: 4px;
  margin-bottom: 4px;
}

.literal-body blockquote {
  margin: 14px 0;
  padding: 10px 16px;
  border-left: 3px solid var(--gold);
  background: #fbfaf4;
  font-size: 12.5px;
  line-height: 1.55;
  color: #333333;
}

.literal-body .data-table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0 18px;
  page-break-inside: auto;
  table-layout: auto;
}

.literal-body .data-table th,
.literal-body .data-table td {
  border: 1px solid var(--line);
  padding: 6px 8px;
  vertical-align: top;
  font-size: 11.5px;
  line-height: 1.4;
  text-align: left;
  word-break: break-word;
}

.literal-body .data-table th {
  background: var(--teal);
  color: #ffffff;
  font-weight: 700;
}

.literal-body .data-table tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

.literal-body .data-table thead {
  display: table-header-group;
}

.literal-body .data-table tbody tr:nth-child(even) {
  background: #f6f8f9;
}

.literal-body hr.section-divider {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 22px 0;
}

.literal-body strong {
  font-weight: 700;
}

.literal-body code {
  background: #f0f0f0;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
`;

export function buildLiteralCorporateHtml(
  cover: CorporateCover,
  blocks: PropuestaBlock[],
  assets: Record<AssetName, string>,
): string {
  const c = cover;
  const contentHtml = blocksToHtml(blocks, true);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manticore Labs - Propuesta ${esc(c.name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${CORPORATE_CSS}</style>
  <style>${LITERAL_CONTENT_CSS}</style>
</head>
<body>
  <main class="document">

    <section class="page page-cover">
      <div class="page-inner">
        <p class="cover-brand">MANTICORE LABS</p>
        <h1 class="cover-title">Propuesta &ldquo;${esc(c.name)}&rdquo;</h1>
        <div class="cover-meta">
          <div class="cover-meta-group">
            <span class="cover-label">N\u00famero referencial:</span>
            <span class="cover-value">${esc(c.code)}</span>
          </div>
          <div class="cover-meta-group">
            <span class="cover-label">Versi\u00f3n:</span>
            <span class="cover-value">${esc(c.version)}</span>
          </div>
        </div>
        <div class="cover-spacer"></div>
        <div class="cover-contact">
          <p class="cover-contact-title">CONTACTANOS:</p>
          <p><a class="cover-contact-link" href="mailto:info@manticore-labs.com">info@manticore-labs.com</a></p>
          <p class="cover-date">${esc(c.fecha)}</p>
          <p class="cover-validity">V\u00e1lido por ${esc(c.validezDias)} d\u00edas</p>
        </div>
        <img class="cover-logo" src="${assets["manticorelogoazul.png"]}" alt="Logo de Manticore Labs">
      </div>
    </section>

    <div class="literal-body">
${contentHtml}
    </div>

  </main>
</body>
</html>`;
}
