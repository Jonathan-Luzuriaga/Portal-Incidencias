/** CSS del bloque de Notion: flujo continuo; Chromium pagina en A4 de forma nativa. */
export const PROPOSAL_FLOW_PRINT_CSS = `
.proposal-flow-print {
  width: 794px;
  box-sizing: border-box;
  padding: 54px 80px 72px 60px;
  break-before: page;
  page-break-before: always;
  position: relative;
  z-index: 1;
}

@media print {
  .flow-print-deco-navy,
  .flow-print-deco-gold {
    position: fixed;
    right: 0;
    width: 45px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    pointer-events: none;
    z-index: 0;
  }
  .flow-print-deco-navy {
    top: 0;
    height: 561px;
    background: var(--navy);
    clip-path: polygon(0 0, 100% 0, 100% 100%);
  }
  .flow-print-deco-gold {
    bottom: 0;
    height: 561px;
    background: var(--gold);
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
  }

  /* Repetir cabecera de tabla en cada página impresa (equivalente a Word). */
  .proposal-flow-print table.data-table thead {
    display: table-header-group;
  }
  .proposal-flow-print table.data-table thead tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}

.proposal-flow-print h2.section-title,
.proposal-flow-print h3.subsection-title {
  break-after: avoid;
  page-break-after: avoid;
}

.proposal-flow-print p,
.proposal-flow-print li,
.proposal-flow-print blockquote {
  font-size: 13px;
  line-height: 1.45;
  font-family: Arial, Helvetica, sans-serif;
  orphans: 3;
  widows: 3;
}

.proposal-flow-print h2.section-title {
  font-size: 15px;
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-weight: 700;
  color: var(--deep-gold);
}

.proposal-flow-print h3.subsection-title {
  font-size: 13px;
  font-weight: 700;
  color: #000000;
}

.proposal-flow-print ul,
.proposal-flow-print ol {
  margin: 0 0 8px 18px;
  padding-left: 16px;
}

.proposal-flow-print li {
  margin-bottom: 4px;
}

.proposal-flow-print ul ul li,
.proposal-flow-print ol ol li {
  font-size: 13px;
  line-height: 1.45;
}

.proposal-flow-print .data-table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0 10px;
  table-layout: fixed;
  break-inside: auto;
  page-break-inside: auto;
}

/* Tablas cortas / precios: no partir (líneas + Subtotal + IVA + Total en la misma hoja). */
.proposal-flow-print .price-table-wrap,
.proposal-flow-print .table-wrap-keep {
  break-inside: avoid;
  page-break-inside: avoid;
}

.proposal-flow-print .data-table.table-keep-together {
  break-inside: avoid;
  page-break-inside: avoid;
}

.proposal-flow-print .data-table thead {
  display: table-header-group;
}

.proposal-flow-print .data-table tfoot {
  display: table-footer-group;
}

/* Tablas largas: repetir thead; filas no se parten por la mitad. */
.proposal-flow-print .data-table:not(.table-keep-together) tbody tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Tablas compactas/precio: evitar salto entre filas (fuerza bloque entero a la siguiente hoja). */
.proposal-flow-print .data-table.table-keep-together tbody tr,
.proposal-flow-print .data-table.table-keep-together tfoot tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

.proposal-flow-print .data-table th,
.proposal-flow-print .data-table td {
  border: 1px solid var(--line);
  padding: 5px 7px;
  vertical-align: top;
  font-size: 12px;
  line-height: 1.35;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.proposal-flow-print .data-table th {
  background: var(--teal);
  color: #ffffff;
  font-weight: 700;
  text-align: left;
}

.proposal-flow-print .price-table th:last-child,
.proposal-flow-print .price-table td:last-child {
  text-align: right;
}
`;
