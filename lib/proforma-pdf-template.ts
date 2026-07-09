import { CORPORATE_CSS } from "./propuesta-pdf/corporate-css";
import { formatMoney } from "./propuesta-pdf/calc";
import { PROFORMA_CSS } from "./proforma-pdf-css";
import {
  calcularProforma,
  TARIFAS_MANTICORE,
  type PerfilDesarrollador,
} from "./proforma-calc";
import { formatCodigoEstimacion, formatCodigoProyecto } from "./proforma-codigos";
import type { ProformaActividadInput } from "./proforma-types";
import { sumarHorasActividades } from "./proforma-types";

export interface ProformaClienteDatos {
  nombre: string;
  lineas: string[];
}

export interface ProformaPdfDatos {
  /** Número o código completo; se normaliza a PROY-6871 */
  codigoProyecto: string;
  /** Número o código completo; se normaliza a EST-000005 */
  codigoEstimacion: string;
  descripcion: string;
  horas: number;
  perfil: PerfilDesarrollador;
  actividades?: ProformaActividadInput[];
  /** Data URI o URL pública del logo; vacío = texto de respaldo */
  logoSrc?: string;
  fechaEstimacion?: Date;
  validezDias?: number;
  cliente?: ProformaClienteDatos;
}

const MANTICORE_EMPRESA = {
  nombre: "Manticore Labs",
  lineas: ["Quito Pichincha", "Ecuador"],
  email: "info@manticore-labs.com",
  web: "manticore-labs.com",
} as const;

const CLIENTE_BAGO_DEFAULT: ProformaClienteDatos = {
  nombre: "Bago del Ecuador",
  lineas: [
    "Lizardo García E10-80 y Av. 12 de Octubre",
    "Edif. Alto Aragón pisos 10-13-14",
    "Quito, Pichincha, Ecuador",
  ],
};

const NOTAS_DEFAULT = "Esperamos seguir haciendo negocios con usted.";

const TERMINOS_DEFAULT = [
  "Validez de la Oferta: Esta estimación es válida por un periodo de 45 días calendario a partir de su fecha de emisión. Transcurrido este plazo, los costos y cronogramas podrán ser sujetos a actualización.",
  "Impuestos: Todos los precios detallados en la presente estimación incluyen el Impuesto al Valor Agregado (IVA) de acuerdo con la normativa vigente.",
  "Entregas y Plazos: Los tiempos de entrega comenzarán a contabilizarse a partir de la recepción del anticipo y de toda la información técnica o accesos necesarios por parte del cliente.",
  "Propiedad de los Trabajos: La transferencia de derechos de uso o propiedad intelectual de los entregables se hará efectiva únicamente una vez que el pago total de la factura haya sido liquidado.",
];

const VALIDEZ_DIAS_DEFAULT = 45;

function esc(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatFechaCorta(date: Date): string {
  return date
    .toLocaleDateString("es-EC", {
      timeZone: "America/Guayaquil",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace(/\./g, "");
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function buildArticuloDescripcion(codigoProyecto: string, descripcion: string): string {
  const desc = descripcion.trim();
  if (codigoProyecto && desc) {
    return `Desarrollo de Software:${codigoProyecto} - ${desc}`;
  }
  if (codigoProyecto) {
    return `Desarrollo de Software:${codigoProyecto}`;
  }
  return `Desarrollo de Software: ${desc}`;
}

function renderLineas(lineas: string[]): string {
  return lineas.map((linea) => `<p>${esc(linea)}</p>`).join("\n");
}

function renderActividadesTable(actividades: ProformaActividadInput[]): string {
  const filas = actividades.filter((a) => a.actividad.trim() || a.descripcion.trim());
  if (filas.length === 0) return "";

  const totalHoras = sumarHorasActividades(filas);
  const rows = filas
    .map(
      (a) => `
            <tr>
              <td class="cell-wrap">${esc(a.actividad)}</td>
              <td class="cell-wrap cell-description">${esc(a.descripcion)}</td>
              <td class="center-cell">${a.horas}</td>
            </tr>`
    )
    .join("\n");

  return `
        <h2 class="proforma-actividades-title">Actividades</h2>
        <table class="data-table data-table-actividades">
          <thead>
            <tr>
              <th>Actividad</th>
              <th>Descripción</th>
              <th>Horas</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="actividades-total">
              <td colspan="2"><strong>Horas estimadas</strong></td>
              <td class="center-cell"><strong>${totalHoras}</strong></td>
            </tr>
          </tbody>
        </table>`;
}

function renderActividadesBlock(actividades: ProformaActividadInput[]): string {
  const table = renderActividadesTable(actividades);
  if (!table) return "";
  return `<div class="proforma-actividades-block">${table}</div>`;
}

function renderPageFooter(pageNumber: number, email: string): string {
  return `
      <footer class="doc-footer">
        <a href="mailto:${esc(email)}">${esc(email)}</a>
        <span>${pageNumber}</span>
      </footer>`;
}

/**
 * Genera el HTML completo de una ESTIMACIÓN corporativa Manticore Labs,
 * réplica visual del formato Zoho usado en las proformas de referencia.
 */
export function generarHtmlProforma(datos: ProformaPdfDatos): string {
  const calculo = calcularProforma(datos.horas, datos.perfil);
  const tarifa = TARIFAS_MANTICORE[datos.perfil];
  const fecha = datos.fechaEstimacion ?? new Date();
  const validezDias = datos.validezDias ?? VALIDEZ_DIAS_DEFAULT;
  const fechaVencimiento = addDays(fecha, validezDias);
  const codigoProyecto = formatCodigoProyecto(datos.codigoProyecto);
  const codigoEstimacion = formatCodigoEstimacion(datos.codigoEstimacion);
  const cliente = datos.cliente ?? CLIENTE_BAGO_DEFAULT;
  const articulo = buildArticuloDescripcion(codigoProyecto, datos.descripcion);
  const logo = datos.logoSrc?.trim() ?? "";
  const actividadesBlock = renderActividadesBlock(datos.actividades ?? []);
  const hasSecondPage = Boolean(actividadesBlock);

  const logoBlock = logo
    ? `<img class="proforma-logo" src="${logo}" alt="Manticore Labs" />`
    : `<div class="proforma-logo" style="font-family:Montserrat,Arial,sans-serif;font-weight:800;color:#1d2856;">MANTICORE LABS</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Estimación ${esc(codigoEstimacion)} — Manticore Labs</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>${CORPORATE_CSS}</style>
  <style>${PROFORMA_CSS}</style>
</head>
<body>
  <main class="document">
    <section class="page page-standard page-proforma page-proforma-sheet" data-proforma-page="1">
      <div class="page-inner page-inner-standard">
        <div class="proforma-header">
          <div>
            <h1 class="proforma-title">ESTIMACIÓN</h1>
            <p class="proforma-number"># ${esc(codigoEstimacion)}</p>
          </div>
          ${logoBlock}
        </div>

        <div class="proforma-addresses">
          <div class="proforma-from">
            <p><strong>${esc(MANTICORE_EMPRESA.nombre)}</strong></p>
            ${renderLineas([...MANTICORE_EMPRESA.lineas])}
            <p><a href="mailto:${esc(MANTICORE_EMPRESA.email)}">${esc(MANTICORE_EMPRESA.email)}</a></p>
            <p>${esc(MANTICORE_EMPRESA.web)}</p>
          </div>
          <div class="proforma-billto">
            <p class="billto-label">Facturar a</p>
            <p><strong>${esc(cliente.nombre)}</strong></p>
            ${renderLineas(cliente.lineas)}
          </div>
        </div>

        <div class="proforma-dates">
          <div>
            <span>Fecha de Estimación:</span>
            <span>${esc(formatFechaCorta(fecha))}</span>
          </div>
          <div>
            <span>Fecha de vencimiento:</span>
            <span>${esc(formatFechaCorta(fechaVencimiento))}</span>
          </div>
        </div>

        <table class="data-table data-table-proforma">
          <thead>
            <tr>
              <th>#</th>
              <th>Artículo &amp; Descripción</th>
              <th>Cant.</th>
              <th>Tarifa</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="center-cell">1</td>
              <td class="cell-wrap cell-description">${esc(articulo)}</td>
              <td>${datos.horas.toFixed(2)}</td>
              <td>${formatMoney(tarifa)}</td>
              <td>${formatMoney(calculo.subtotal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="proforma-totals-wrap">
          <table class="proforma-totals">
            <tbody>
              <tr>
                <td class="label">Subtotal</td>
                <td class="value">${formatMoney(calculo.subtotal)}</td>
              </tr>
              <tr>
                <td class="label">IVA (15%)</td>
                <td class="value">${formatMoney(calculo.iva)}</td>
              </tr>
              <tr class="total">
                <td class="label">Total</td>
                <td class="value">$${formatMoney(calculo.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${
          !hasSecondPage
            ? `
        <h2 class="proforma-section-title">Notas</h2>
        <div class="proforma-notes">
          <p>${esc(NOTAS_DEFAULT)}</p>
        </div>

        <h2 class="proforma-section-title">Términos y condiciones</h2>
        <div class="proforma-terms">
          ${TERMINOS_DEFAULT.map((p) => `<p>${esc(p)}</p>`).join("\n")}
        </div>`
            : ""
        }
      </div>
      ${renderPageFooter(1, MANTICORE_EMPRESA.email)}
    </section>
    ${
      hasSecondPage
        ? `
    <section class="page page-standard page-proforma page-proforma-sheet page-proforma-continued" data-proforma-page="2">
      <div class="page-inner page-inner-standard">
        ${actividadesBlock}

        <h2 class="proforma-section-title">Notas</h2>
        <div class="proforma-notes">
          <p>${esc(NOTAS_DEFAULT)}</p>
        </div>

        <h2 class="proforma-section-title">Términos y condiciones</h2>
        <div class="proforma-terms">
          ${TERMINOS_DEFAULT.map((p) => `<p>${esc(p)}</p>`).join("\n")}
        </div>
      </div>
      ${renderPageFooter(2, MANTICORE_EMPRESA.email)}
    </section>`
        : ""
    }
  </main>
</body>
</html>`;
}
