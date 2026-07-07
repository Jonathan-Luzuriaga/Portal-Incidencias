/**
 * CSS corporativo de la propuesta Manticore Labs.
 * Copiado verbatim desde ai-workflows/workflows/propuestas/templates/PropuestaActualizacion.css.
 * Se embebe como string para garantizar que viaje en el bundle serverless (sin lecturas de disco).
 * No modificar los valores de marca (colores, tipografías, proporciones de columnas).
 */
export const CORPORATE_CSS = `
:root {
  --navy: #1d2856;
  --gold: #f4be00;
  --deep-gold: #ffb700;
  --teal: #25556c;
  --text: #111111;
  --muted: #676767;
  --page-bg: #ffffff;
  --app-bg: #ffffff;
  --line: #b8b8b8;
}

*,
*::before,
*::after { box-sizing: border-box; }

html, body { margin: 0; padding: 0; }

body {
  background: #ffffff;
  color: var(--text);
  font-family: Arial, Helvetica, sans-serif;
  padding: 0;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

img { display: block; max-width: 100%; }

a { color: #2f67c7; text-decoration: underline; }

.document { display: flex; flex-direction: column; align-items: center; gap: 0; }

.page {
  width: 794px;
  height: 1122px;
  position: relative;
  overflow: hidden;
  background: var(--page-bg);
  border: none;
  break-after: page;
  page-break-after: always;
  page-break-inside: avoid;
}

.page:last-child { break-after: auto; page-break-after: auto; }

.page-inner { position: relative; z-index: 2; height: 100%; }

.page-cover::before {
  content: "";
  position: absolute;
  top: 0; right: 0;
  width: 302px; height: 360px;
  background: var(--navy);
  clip-path: polygon(100% 0, 100% 100%, 0 0);
}

.page-cover::after {
  content: "";
  position: absolute;
  right: 0; bottom: 0;
  width: 248px; height: 760px;
  background: var(--gold);
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

.page-standard::before {
  content: "";
  position: absolute;
  top: 0; right: 0;
  width: 45px; height: 50%;
  background: var(--navy);
  clip-path: polygon(0 0, 100% 0, 100% 100%);
  z-index: 0;
}

.page-standard::after {
  content: "";
  position: absolute;
  bottom: 0; right: 0;
  width: 45px; height: 50%;
  background: var(--gold);
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
  z-index: 0;
}

.page-cover .page-inner {
  height: 100%;
  padding: 78px 52px 48px 58px;
  display: flex;
  flex-direction: column;
}

.page-inner-standard {
  height: calc(100% - 36px);
  padding: 54px 80px 0 60px;
  overflow: hidden;
}

.cover-brand {
  margin: 48px 0 0;
  color: var(--deep-gold);
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 20px; font-weight: 700; letter-spacing: 0.01em;
}

.cover-title {
  margin: 80px 0 0;
  color: #102a66;
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 44px; font-weight: 800; line-height: 1.15;
  max-width: 85%;
}

.cover-meta { margin-top: 48px; display: flex; flex-direction: column; gap: 28px; }

.cover-spacer { flex: 1; min-height: 24px; }

.cover-label, .cover-value {
  display: block;
  color: var(--deep-gold);
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-weight: 700;
}

.cover-label { font-size: 18px; margin-bottom: 8px; }
.cover-value { font-size: 18px; }

.cover-contact { position: relative; z-index: 3; margin-bottom: 8px; }
.cover-contact p { margin: 0 0 2px; color: #111111; font-size: 13px; font-weight: 700; line-height: 1.35; }
.cover-contact-link { color: inherit; text-decoration: none; }
.cover-contact-title { margin-bottom: 4px; font-size: 12px; }
.cover-date { margin-top: 6px; font-weight: 700; }
.cover-validity { margin-top: 2px; }

.cover-logo { position: absolute; right: -45px; bottom: 50px; width: 300px; z-index: 3; }

.index-title {
  margin: 48px 0 36px; text-align: center;
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 29px; font-weight: 800; color: #000000;
}

.index-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.index-table td { padding: 2px 4px; font-size: 12px; font-weight: 700; color: #000000; }
.index-table td:last-child { width: 40px; text-align: right; }
.index-indent td:first-child { padding-left: 18px; font-weight: 400; }

.quote-layout { display: flex; align-items: center; gap: 66px; padding-top: 190px; }
.quote-logo { width: 170px; margin-left: 6px; }
.quote-copy blockquote {
  margin: 0 0 26px; color: #16489d;
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 24px; font-weight: 800; line-height: 1.25;
}
.quote-author {
  margin: 0 0 0 108px; color: #5e584e;
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 18px; font-weight: 600; letter-spacing: 0.01em;
}

.section-title {
  margin: 0 0 18px; color: var(--deep-gold);
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 15px; font-weight: 700;
}
.section-gap-large { margin-top: 36px; }
.section-gap-medium { margin-top: 22px; }

.subsection-title { margin: 16px 0 8px; color: #000000; font-size: 13px; font-weight: 700; }
.subsection-spacing { margin-top: 20px; }

.page-inner-standard p {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.45;
  text-align: justify;
  text-justify: inter-word;
  page-break-inside: avoid;
  break-inside: avoid;
}

p { margin: 0 0 8px; font-size: 13px; line-height: 1.45; page-break-inside: avoid; break-inside: avoid; }

.clause-block { page-break-inside: avoid; break-inside: avoid; }

.content-list, .phase-list, .solution-list, .payment-list { margin: 0 0 8px 18px; padding-left: 16px; page-break-inside: avoid; break-inside: avoid; }
.content-list li, .phase-list li, .solution-list li, .payment-list li { margin-bottom: 4px; font-size: 13px; line-height: 1.45; page-break-inside: avoid; break-inside: avoid; }
.phase-list>li { margin-bottom: 4px; }
.phase-list ul li { font-size: 12px; line-height: 1.5; margin-bottom: 1px; }
.phase-list ul, .solution-sublist, .payment-list ul { margin: 2px 0 0 0; padding-left: 30px; }
.phase-list ul li, .solution-sublist li, .payment-list ul li { margin-bottom: 2px; }
.solution-list { padding-left: 14px; }
.solution-list>li { margin-bottom: 4px; }
.solution-sublist { list-style: lower-alpha; }
.payment-list>li>span { display: inline-block; font-weight: 400; }

.content-figure { margin: 18px auto 28px; text-align: center; }
.content-figure img { margin: 0 auto; border: 1px solid #202020; background: #ffffff; }
.content-figure figcaption { margin-top: 7px; font-size: 12px; color: #000000; }
.figure-large img { width: 284px; }
.figure-wide img { width: 408px; }
.figure-small img { width: 220px; }
.figure-medium img { width: 248px; }
.figure-top { margin-top: 18px; margin-bottom: 20px; }
.figure-bottom { margin-top: 24px; margin-bottom: 0; }

.data-table { width: 100%; border-collapse: collapse; margin: 10px 0 10px; table-layout: fixed; page-break-inside: auto; }
.data-table thead { display: table-header-group; }
.data-table tr { page-break-inside: avoid; break-inside: avoid; }
.data-table th, .data-table td { border: 1px solid var(--line); padding: 5px 7px; vertical-align: top; font-size: 12px; line-height: 1.35; word-break: break-word; overflow-wrap: anywhere; hyphens: auto; }
.data-table th { background: var(--teal); color: #ffffff; font-weight: 700; text-align: left; }
.data-table-solutions th:nth-child(2) { white-space: nowrap; hyphens: none; overflow-wrap: normal; word-break: normal; }
.data-table-roles { width: 100%; }

.data-table-personal th:nth-child(1), .data-table-personal td:nth-child(1) { width: 28%; }
.data-table-personal th:nth-child(2), .data-table-personal td:nth-child(2) { width: 15%; text-align: center; }
.data-table-personal th:nth-child(3), .data-table-personal td:nth-child(3) { width: 57%; }
.data-table-personal-continued { margin-top: 14px; }
.data-table-personal-continued td { padding-top: 10px; padding-bottom: 10px; }

.center-cell { text-align: center; }

.note-small { margin-top: 12px; font-size: 12px; font-weight: 700; line-height: 1.5; }
.note-inline { margin: 8px 0 10px; font-size: 11px; line-height: 1.45; }

.data-table-activities th:nth-child(1), .data-table-activities td:nth-child(1) { width: 28%; text-align: center; }
.data-table-activities th:nth-child(2), .data-table-activities td:nth-child(2) { width: 42%; }
.data-table-activities th:nth-child(3), .data-table-activities td:nth-child(3) { width: 15%; text-align: center; }
.data-table-activities th:nth-child(4), .data-table-activities td:nth-child(4) { width: 15%; text-align: center; }

.data-table-solutions th:nth-child(1), .data-table-solutions td:nth-child(1) { width: 18%; }
.data-table-solutions th:nth-child(2), .data-table-solutions td:nth-child(2) { width: 12%; text-align: center; }
.data-table-solutions th:nth-child(3), .data-table-solutions td:nth-child(3) { width: 32%; }
.data-table-solutions th:nth-child(4), .data-table-solutions td:nth-child(4) { width: 38%; }

.data-table-requirements th:nth-child(1), .data-table-requirements td:nth-child(1) { width: 8%; text-align: center; }
.data-table-requirements th:nth-child(2), .data-table-requirements td:nth-child(2) { width: 24%; }
.data-table-requirements th:nth-child(3), .data-table-requirements td:nth-child(3) { width: 50%; }
.data-table-requirements th:nth-child(4), .data-table-requirements td:nth-child(4) { width: 18%; text-align: center; }

.table-bullets { margin: 0; padding-left: 16px; word-break: break-word; overflow-wrap: anywhere; }
.table-bullets li { margin-bottom: 2px; word-break: break-word; overflow-wrap: anywhere; }

.data-table-stages th:nth-child(1), .data-table-stages td:nth-child(1) { width: 34%; text-align: center; }
.data-table-stages th:nth-child(2), .data-table-stages td:nth-child(2) { width: 18%; text-align: center; }
.data-table-stages th:nth-child(3), .data-table-stages td:nth-child(3) { width: 48%; }

.price-table { width: 100%; border-collapse: collapse; margin: 24px 0 10px; table-layout: fixed; }
.price-table th, .price-table td { padding: 8px 12px; font-size: 12px; vertical-align: top; }
.price-table thead th { background: var(--teal); color: #ffffff; font-weight: 700; text-align: left; }
.price-table thead th:last-child { text-align: right; }
.price-table tbody td { border-left: 1px solid #dadada; border-right: 1px solid #dadada; }
.price-main td { border-bottom: 1px dashed #d6d6d6; padding-top: 14px; padding-bottom: 16px; }
.price-items { margin: 0; padding-left: 20px; }
.price-items li { margin-bottom: 14px; font-size: 12px; }
.price-values { text-align: right; font-weight: 700; }
.price-values div { margin-bottom: 14px; }
.price-summary td { border-top: 1px solid #d6d6d6; padding-top: 7px; padding-bottom: 7px; }
.price-summary td:last-child, .price-total td:last-child { text-align: right; }
.price-total td { border-top: 1px solid #d6d6d6; border-bottom: 1px solid #d6d6d6; color: #0d5b7d; padding-top: 8px; padding-bottom: 8px; }
.price-note { margin-top: 8px; font-size: 12px; font-weight: 700; }

.page-last { padding-top: 24px; }

/* SDE-863 — compactación de páginas densas (workflow 4.4) */
.page-compact .section-title { margin-bottom: 10px; }
.page-compact .section-gap-medium { margin-top: 16px; }
.page-compact .subsection-title { margin-top: 8px; margin-bottom: 6px; }
.page-compact .subsection-spacing { margin-top: 12px; }
.page-compact p { margin: 4px 0; line-height: 1.45; }
.page-compact .content-list li,
.page-compact .phase-list li { margin-bottom: 2px; line-height: 1.45; }
.page-compact .content-figure { margin: 10px auto 14px; }
.page-compact .note-inline { margin: 8px 0 10px; line-height: 1.45; }

.page-index .index-title { margin: 28px 0 18px; }
.page-index .index-table td { padding: 6px 0; line-height: 1.35; }
.page-index .index-table { margin-top: 8px; }

.page-quote .quote-layout { min-height: 1122px; padding-top: 0; align-items: center; }
.page-cover .cover-logo { bottom: 24px; }

.page-final .section-gap-medium { margin-top: 14px; }
.page-final .payment-list { margin-bottom: 6px; }

.page-inner-standard .center-cell { text-align: center; }
.page-inner-standard .price-values,
.page-inner-standard .price-summary td:last-child,
.page-inner-standard .price-total td:last-child { text-align: right; }
.page-inner-standard .note-small,
.page-inner-standard .price-note { text-align: justify; }

.doc-footer {
  position: absolute; left: 60px; right: 56px; bottom: 18px; z-index: 3;
  display: flex; align-items: center; justify-content: space-between; font-size: 11px;
}
.doc-footer span { color: #000000; }

/* Paginas con contenido variable: permiten que tablas largas fluyan en lugar de cortarse */
.page-dynamic {
  height: auto;
  min-height: 1122px;
  overflow: visible;
  page-break-inside: auto;
}
.page-dynamic .page-inner-standard {
  height: auto;
  min-height: calc(1122px - 36px);
  overflow: visible;
}
.page-dynamic .data-table {
  page-break-inside: auto;
}
.page-dynamic .data-table tr {
  page-break-inside: avoid;
  break-inside: avoid;
}
.page-dynamic .data-table thead {
  display: table-header-group;
}

@page { size: A4; margin: 0; }
`;
