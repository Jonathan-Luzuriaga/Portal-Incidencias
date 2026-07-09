/**
 * Estilos adicionales para la plantilla de ESTIMACIÓN (proforma).
 * Reutiliza las variables CSS corporativas definidas en corporate-css.ts.
 */
export const PROFORMA_CSS = `
.page-proforma-sheet {
  height: auto;
  min-height: 1122px;
  overflow: visible;
  page-break-after: always;
  break-after: page;
}

.page-proforma-sheet:last-child {
  page-break-after: auto;
  break-after: auto;
}

.page-proforma-continued {
  page-break-before: always;
  break-before: page;
}

.page-proforma-sheet .page-inner-standard {
  height: auto;
  min-height: calc(1122px - 36px);
  overflow: visible;
  padding-top: 48px;
}

.page-proforma .data-table-proforma td,
.page-proforma .data-table-actividades td,
.page-proforma .data-table-proforma th,
.page-proforma .data-table-actividades th {
  height: auto;
  max-height: none;
  overflow: visible;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: break-word;
  vertical-align: top;
}

.page-proforma .cell-description {
  text-align: left;
  hyphens: auto;
}

.page-proforma .data-table tr {
  page-break-inside: auto;
  break-inside: auto;
}

.page-proforma {
  height: auto;
  min-height: 1122px;
  overflow: visible;
}

.page-proforma .page-inner-standard {
  height: auto;
  min-height: calc(1122px - 36px);
  overflow: visible;
  padding-top: 48px;
}

.proforma-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}

.proforma-title {
  margin: 0;
  color: var(--navy);
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.1;
}

.proforma-number {
  margin: 8px 0 0;
  color: var(--muted);
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 14px;
  font-weight: 600;
}

.proforma-logo {
  width: 150px;
  height: auto;
  flex-shrink: 0;
  margin-top: 4px;
}

.proforma-addresses {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  margin-bottom: 24px;
}

.proforma-from p,
.proforma-billto p {
  margin: 0 0 2px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text);
}

.proforma-from strong,
.proforma-billto strong {
  font-size: 13px;
  font-weight: 700;
}

.proforma-from a,
.proforma-billto a {
  color: #2f67c7;
  text-decoration: none;
}

.billto-label {
  margin: 0 0 6px !important;
  color: var(--muted) !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.proforma-dates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  max-width: 520px;
  margin-left: auto;
  margin-bottom: 22px;
  font-size: 12px;
}

.proforma-dates div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px solid #ececec;
}

.proforma-dates span:first-child {
  color: var(--muted);
  font-weight: 600;
}

.proforma-dates span:last-child {
  color: var(--text);
  font-weight: 700;
  text-align: right;
}

.data-table-proforma {
  margin-top: 8px;
  margin-bottom: 0;
}

.data-table-proforma th:nth-child(1),
.data-table-proforma td:nth-child(1) {
  width: 6%;
  text-align: center;
}

.data-table-proforma th:nth-child(2),
.data-table-proforma td:nth-child(2) {
  width: 48%;
}

.data-table-proforma th:nth-child(3),
.data-table-proforma td:nth-child(3),
.data-table-proforma th:nth-child(4),
.data-table-proforma td:nth-child(4),
.data-table-proforma th:nth-child(5),
.data-table-proforma td:nth-child(5) {
  width: 15%;
  text-align: right;
}

.data-table-proforma td:nth-child(2) {
  text-align: left;
}

.proforma-totals-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 0;
}

.proforma-totals {
  width: 280px;
  border-collapse: collapse;
  margin: 0;
}

.proforma-totals td {
  padding: 7px 10px;
  font-size: 12px;
  border-bottom: 1px solid #e8e8e8;
}

.proforma-totals td.label {
  color: var(--muted);
  text-align: left;
  font-weight: 600;
}

.proforma-totals td.value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  font-weight: 700;
}

.proforma-totals tr.total td {
  border-top: 2px solid var(--navy);
  border-bottom: none;
  padding-top: 10px;
  font-size: 13px;
  color: var(--navy);
}

.proforma-section-title {
  margin: 28px 0 8px;
  color: var(--navy);
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 13px;
  font-weight: 700;
}

.proforma-notes p,
.proforma-terms p {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text);
  text-align: justify;
}

.proforma-terms {
  margin-top: 4px;
}

.proforma-actividades-block {
  margin-top: 36px;
  page-break-before: auto;
}

.proforma-actividades-title {
  margin: 0 0 12px;
  color: #c9a227;
  font-family: "Montserrat", Arial, Helvetica, sans-serif;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.data-table-actividades {
  margin-top: 0;
  margin-bottom: 8px;
}

.data-table-actividades th:nth-child(1),
.data-table-actividades td:nth-child(1) {
  width: 22%;
  text-align: left;
}

.data-table-actividades th:nth-child(2),
.data-table-actividades td:nth-child(2) {
  width: 58%;
  text-align: left;
}

.data-table-actividades th:nth-child(3),
.data-table-actividades td:nth-child(3) {
  width: 20%;
  text-align: center;
}

.data-table-actividades tr.actividades-total td {
  border-top: 2px solid var(--navy);
  background: #f7f8fb;
  font-size: 12px;
  padding-top: 10px;
  padding-bottom: 10px;
}
`;
