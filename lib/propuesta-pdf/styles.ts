/**
 * CSS corporativo para el PDF de propuestas (Manticore Labs).
 * Portada con formas navy/gold (clip-path) + tipografía y tablas corporativas.
 * Pensado para render con Puppeteer (printBackground, footer via Puppeteer).
 */
export const PROPUESTA_PDF_CSS = `
:root {
  --navy: #1d2856;
  --gold: #f4be00;
  --deep-gold: #ffb700;
  --teal: #25556c;
  --text: #111111;
  --muted: #676767;
  --line: #b8b8b8;
}

* , *::before, *::after { box-sizing: border-box; }

html, body { margin: 0; padding: 0; }

body {
  color: var(--text);
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

a { color: #2f67c7; text-decoration: none; }

/* ---------- Portada ---------- */
/* El área imprimible se define por los márgenes de Puppeteer (16/14mm). */
.page-cover {
  position: relative;
  width: 182mm;
  height: 265mm;
  overflow: hidden;
  background: #ffffff;
  page-break-after: always;
  break-after: page;
  padding: 18mm 16mm 16mm;
}

.page-cover::before {
  content: "";
  position: absolute;
  top: 0; right: 0;
  width: 74mm; height: 88mm;
  background: var(--navy);
  clip-path: polygon(100% 0, 100% 100%, 0 0);
}

.page-cover::after {
  content: "";
  position: absolute;
  right: 0; bottom: 0;
  width: 60mm; height: 175mm;
  background: var(--gold);
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

.cover-brand {
  position: relative; z-index: 2;
  margin: 0;
  color: var(--deep-gold);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.cover-title {
  position: relative; z-index: 2;
  margin: 42mm 0 0;
  max-width: 150mm;
  color: #102a66;
  font-size: 44px;
  font-weight: 800;
  line-height: 1.18;
}

.cover-meta {
  position: relative; z-index: 2;
  margin-top: 30mm;
  display: flex;
  flex-direction: column;
  gap: 12mm;
}

.cover-label, .cover-value {
  display: block;
  color: var(--deep-gold);
  font-weight: 700;
  font-size: 16px;
}
.cover-label { margin-bottom: 4px; }

.cover-contact {
  position: absolute;
  left: 18mm; bottom: 24mm;
  z-index: 3;
}
.cover-contact p { margin: 0 0 6px; color: #111111; font-size: 12px; font-weight: 700; }
.cover-contact-title { font-size: 11px; }
.cover-date { margin-top: 12px; font-weight: 400; }
.cover-validity { margin-top: 8px; }

/* ---------- Contenido ---------- */
/* Sin padding propio: los márgenes por página los aplica Puppeteer. */
.content {
  font-family: "Open Sans", Arial, Helvetica, sans-serif;
}

.content h1.section-title,
.content h2.section-title {
  margin: 26px 0 12px;
  color: var(--deep-gold);
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 16px;
  font-weight: 700;
  break-after: avoid;
  page-break-after: avoid;
}

.content h3.subsection-title {
  margin: 18px 0 10px;
  color: #000000;
  font-size: 13px;
  font-weight: 700;
  break-after: avoid;
  page-break-after: avoid;
}

.content p {
  margin: 0 0 12px;
  font-size: 12.5px;
  line-height: 1.75;
  text-align: justify;
}

.content ul, .content ol {
  margin: 0 0 12px 4px;
  padding-left: 22px;
}
.content li { margin-bottom: 6px; font-size: 12.5px; line-height: 1.7; }
.content li > ul, .content li > ol { margin-top: 6px; margin-bottom: 4px; }

.content blockquote {
  margin: 12px 0;
  padding: 8px 14px;
  border-left: 3px solid var(--gold);
  background: #fbfaf4;
  font-size: 12px;
  line-height: 1.65;
  color: #333333;
}

.content hr.section-divider {
  border: none;
  border-top: 1px solid #e6e6e6;
  margin: 18px 0;
}

.content strong { font-weight: 700; }

/* ---------- Tablas ---------- */
.content table.data-table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0 16px;
  break-inside: auto;
}
.content table.data-table th,
.content table.data-table td {
  border: 1px solid var(--line);
  padding: 6px 8px;
  vertical-align: top;
  font-size: 11.5px;
  line-height: 1.4;
  text-align: left;
}
.content table.data-table th {
  background: var(--teal);
  color: #ffffff;
  font-weight: 700;
}
.content table.data-table tr { break-inside: avoid; page-break-inside: avoid; }
.content table.data-table tbody tr:nth-child(even) { background: #f6f8f9; }
.content table.data-table ul { margin: 0; padding-left: 16px; }

@page {
  size: A4;
  margin: 0;
}
`;
