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
.page-flow-chunk .page-inner-standard .table-wrap-keep {
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
`;
