/** Fuente sin paginar; paginateProposalFlow() la convierte en páginas A4 en render.ts */
export const PROPOSAL_FLOW_LAYOUT_CSS = `
.proposal-flow {
  width: 794px;
  box-sizing: border-box;
  padding: 54px 80px 0 60px;
}
.proposal-flow .section-title,
.proposal-flow .subsection-title {
  break-after: avoid;
  page-break-after: avoid;
}
.proposal-flow .section-gap-large { margin-top: 22px; }
.proposal-flow .section-gap-medium { margin-top: 14px; }
.proposal-flow p,
.proposal-flow li,
.proposal-flow .data-table td,
.proposal-flow .field-block,
.proposal-flow .field-label,
.proposal-flow .note-inline,
.proposal-flow .clause-block {
  text-align: justify;
  text-justify: inter-word;
}
.proposal-flow p,
.proposal-flow li {
  orphans: 3;
  widows: 3;
}
.proposal-flow .costs-disclaimer {
  text-align: justify;
  text-justify: inter-word;
}
.page-flow-tall {
  height: auto !important;
  min-height: 1122px !important;
  overflow: visible;
  page-break-inside: auto;
  break-inside: auto;
}
.page-flow-tall .page-inner-standard {
  height: auto !important;
  overflow: visible;
}
.page-flow-tall .data-table {
  page-break-inside: auto;
}
`;

/** Estilos del contenido Notion una vez paginado en .page-flow-chunk */
export const PROPOSAL_FLOW_PRINT_CSS = `
.page-flow-chunk .page-inner-standard .section-title,
.page-flow-chunk .page-inner-standard .subsection-title,
.page-flow-chunk .page-inner-standard .hu-title {
  break-after: avoid;
  page-break-after: avoid;
}

.page-flow-chunk .page-inner-standard .field-block {
  break-inside: avoid;
  page-break-inside: avoid;
  margin: 0 0 8px;
}

.page-flow-chunk .page-inner-standard .field-block-loose {
  break-inside: auto;
  page-break-inside: auto;
}

.page-flow-chunk .page-inner-standard .field-label {
  margin: 0 0 4px;
  break-after: avoid;
  page-break-after: avoid;
}

.page-flow-chunk .page-inner-standard .hu-title + .field-block {
  break-before: avoid;
  page-break-before: avoid;
}

.page-flow-chunk .page-inner-standard .price-table-wrap,
.page-flow-chunk .page-inner-standard .table-wrap-keep,
.page-flow-chunk .page-inner-standard .costs-block {
  break-inside: avoid;
  page-break-inside: avoid;
}

.page-flow-chunk .page-inner-standard .data-table thead {
  display: table-header-group;
}

.page-flow-chunk .page-inner-standard .data-table tfoot {
  display: table-footer-group;
}

.page-flow-chunk .page-inner-standard .data-table:not(.table-keep-together) tbody tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

.page-flow-chunk .page-inner-standard .data-table.table-keep-together tbody tr,
.page-flow-chunk .page-inner-standard .data-table.table-keep-together tfoot tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

.page-flow-chunk .page-inner-standard .price-table th:last-child,
.page-flow-chunk .page-inner-standard .price-table td:last-child {
  text-align: right;
}

.page-flow-chunk .page-inner-standard .costs-disclaimer {
  text-align: justify;
  text-justify: inter-word;
}

.page-flow-chunk .page-inner-standard p,
.page-flow-chunk .page-inner-standard li,
.page-flow-chunk .page-inner-standard .data-table td,
.page-flow-chunk .page-inner-standard .field-block,
.page-flow-chunk .page-inner-standard .field-label,
.page-flow-chunk .page-inner-standard .note-inline,
.page-flow-chunk .page-inner-standard .clause-block,
.page-flow-chunk .page-inner-standard .price-table tbody td {
  text-align: justify;
  text-justify: inter-word;
}
`;
