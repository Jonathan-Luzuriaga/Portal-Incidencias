/**
 * Plantilla corporativa LITERAL: formato fijo Manticore (12 páginas) + contenido
 * tal cual está en Notion, sin reestructurar tablas ni inventar datos.
 *
 * Páginas 1–6: portada, índice, cita y metodología SCRUM (plantilla fija).
 * Páginas 7+: secciones de Notion transcritas con blocksToHtml().
 */
import { CORPORATE_CSS } from "./corporate-css";
import { blocksToHtml, type PropuestaBlock } from "./html";
import { filterDynamicContentBlocks, parseProposalFromBlocks } from "./notion-parser";
import type { CorporateCover } from "./corporate-types";
import type { AssetName } from "./assets";

function esc(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function objetivosHtml(objetivos: string[]): string {
  const items = objetivos.length
    ? objetivos
    : ["Cubrir los requerimientos funcionales solicitados por el cliente."];
  return items.map((o) => `<li>${esc(o)}</li>`).join("\n");
}

function docFooter(pageNum: number): string {
  return `<footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>${pageNum}</span></footer>`;
}

/** Contenido variable: un solo flujo continuo (Chromium pagina en A4 sin cajas fijas por sección). */
const PROPOSAL_FLOW_CSS = `
.proposal-flow {
  width: 794px;
  position: relative;
  background: var(--page-bg);
  box-sizing: border-box;
  padding: 54px 80px 64px 60px;
  break-before: page;
  page-break-before: always;
}
.proposal-flow .section-title,
.proposal-flow .subsection-title {
  break-after: avoid;
  page-break-after: avoid;
}
.proposal-flow .section-title + *,
.proposal-flow .subsection-title + * {
  break-before: avoid;
  page-break-before: avoid;
}
.proposal-flow p,
.proposal-flow li {
  orphans: 3;
  widows: 3;
}
.proposal-flow ul,
.proposal-flow ol {
  break-inside: auto;
  page-break-inside: auto;
}
.proposal-flow .data-table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0 18px;
  break-inside: auto;
  page-break-inside: auto;
}
.proposal-flow .data-table tr {
  break-inside: avoid;
  page-break-inside: avoid;
}
.proposal-flow .data-table thead {
  display: table-header-group;
}
.proposal-flow .data-table th,
.proposal-flow .data-table td {
  border: 1px solid var(--line);
  padding: 6px 8px;
  vertical-align: top;
  font-size: 11.5px;
  line-height: 1.4;
}
.proposal-flow .data-table th {
  background: var(--teal);
  color: #ffffff;
  font-weight: 700;
}
@media print {
  .flow-print-footer {
    position: fixed;
    bottom: 18px;
    left: 60px;
    right: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    z-index: 9999;
  }
}
`;

function buildFixedPages(
  c: CorporateCover,
  assets: Record<AssetName, string>,
  objetivos: string[],
  scrumMaster: string,
  qaResponsable: string,
): string {
  return `
    <section class="page page-cover">
      <div class="page-inner">
        <p class="cover-brand">MANTICORE LABS</p>
        <h1 class="cover-title">Propuesta &ldquo;${esc(c.name)}&rdquo;</h1>
        <div class="cover-meta">
          <div class="cover-meta-group">
            <span class="cover-label">Número referencial:</span>
            <span class="cover-value">${esc(c.code)}</span>
          </div>
          <div class="cover-meta-group">
            <span class="cover-label">Versión:</span>
            <span class="cover-value">${esc(c.version)}</span>
          </div>
        </div>
        <div class="cover-spacer"></div>
        <div class="cover-contact">
          <p class="cover-contact-title">CONTACTANOS:</p>
          <p><a class="cover-contact-link" href="mailto:info@manticore-labs.com">info@manticore-labs.com</a></p>
          <p class="cover-date">${esc(c.fecha)}</p>
          <p class="cover-validity">Válido por ${esc(c.validezDias)} días</p>
        </div>
        <img class="cover-logo" src="${assets["manticorelogoazul.png"]}" alt="Logo de Manticore Labs">
      </div>
    </section>

    <section class="page page-standard page-index">
      <div class="page-inner page-inner-standard">
        <h2 class="index-title">Índice</h2>
        <table class="index-table">
          <tbody>
            <tr><td>Propuesta &ldquo;${esc(c.name)}&rdquo;</td><td>1</td></tr>
            <tr><td>Objetivos</td><td>4</td></tr>
            <tr><td>Descripción y metodología</td><td>4</td></tr>
            <tr class="index-indent"><td>Responsabilidad del Proveedor</td><td>5</td></tr>
            <tr class="index-indent"><td>Responsabilidad del Cliente</td><td>6</td></tr>
            <tr><td>Descripción de la solución</td><td>7</td></tr>
            <tr><td>Personal</td><td>8</td></tr>
            <tr><td>Actividades</td><td>8</td></tr>
            <tr><td>No Incluye</td><td>9</td></tr>
            <tr><td>Tiempos y costos de la solución</td><td>10</td></tr>
            <tr><td>Nota</td><td>10</td></tr>
            <tr><td>Forma de pago</td><td>11</td></tr>
            <tr><td>Conclusiones</td><td>12</td></tr>
          </tbody>
        </table>
      </div>
      ${docFooter(2)}
    </section>

    <section class="page page-standard page-quote">
      <div class="page-inner page-inner-standard quote-layout">
        <img class="quote-logo" src="${assets["manticore-logo-full.png"]}" alt="Logo de Manticore Labs">
        <div class="quote-copy">
          <blockquote>&ldquo;Design is not just what it<br>looks like and feels like.<br>Design is how it works.&rdquo;</blockquote>
          <p class="quote-author">STEVE JOBS</p>
        </div>
      </div>
      ${docFooter(3)}
    </section>

    <section class="page page-standard page-compact">
      <div class="page-inner page-inner-standard">
        <h2 class="section-title">Objetivos</h2>
        <ul class="content-list">
${objetivosHtml(objetivos)}
        </ul>

        <h2 class="section-title">Descripción y metodología</h2>
        <p>Manticore Labs se va a encargar del desarrollo de los nuevos módulos y modificaciones solicitadas, vale la pena revisar las fases de desarrollo de software y la metodología que se va a utilizar. La metodología dentro del equipo de Manticore Labs es SCRUM. A continuación se va a describir las metodologías y las fases de desarrollo:</p>
        <figure class="content-figure figure-large">
          <img src="${assets["imagen1.png"]}" alt="Proceso integral de desarrollo de software">
          <figcaption><strong>Imagen 1 -</strong> Proceso integral de desarrollo de software</figcaption>
        </figure>
        <ul class="phase-list">
          <li><strong>Requerimientos</strong><ul><li>Se toman los requerimientos del sistema</li></ul></li>
          <li><strong>Diseño</strong><ul><li>Se evalúan los requerimientos para transformarlos en historias de usuario</li></ul></li>
          <li><strong>Desarrollo</strong><ul><li>Se desarrollan los requisitos</li></ul></li>
          <li><strong>Pruebas</strong><ul><li>Se evalúa que cumplan los requerimientos implementados por el equipo de desarrollo</li></ul></li>
          <li><strong>Despliegue</strong><ul><li>Se envían los cambios a los servidores de pruebas o producción</li></ul></li>
          <li><strong>Operaciones</strong><ul><li>Se revisa que el proceso haya culminado satisfactoriamente en el ambiente deseado</li></ul></li>
        </ul>
      </div>
      ${docFooter(4)}
    </section>

    <section class="page page-standard page-compact">
      <div class="page-inner page-inner-standard">
        <p>Dentro de la metodología SCRUM el proceso es levantar los requerimientos, luego ir construyéndose en un período corto de tiempo para que el cliente pueda validarlos.</p>
        <figure class="content-figure figure-wide figure-top">
          <img src="${assets["imagen2.png"]}" alt="Metodología Scrum">
          <figcaption><strong>Imagen 2 -</strong> Metodología Scrum</figcaption>
        </figure>
        <p>Los roles de SCRUM son una pieza fundamental para definir las responsabilidades dentro del proyecto.</p>
        <figure class="content-figure figure-small">
          <img src="${assets["imagen3.png"]}" alt="Diagrama Scrum">
          <figcaption><strong>Imagen 3 -</strong> Diagrama de costo del cambio</figcaption>
        </figure>
        <p>En la siguiente tabla se definen los diferentes roles de SCRUM:</p>
        <table class="data-table data-table-roles">
          <thead><tr><th>Rol</th><th>Responsable Manticore Labs</th></tr></thead>
          <tbody>
            <tr><td>Product Owner</td><td>Cliente</td></tr>
            <tr><td>Scrum Master</td><td>${esc(scrumMaster || "Manticore Labs")}</td></tr>
            <tr><td>QA</td><td>${esc(qaResponsable || "Manticore Labs")}</td></tr>
            <tr><td>Equipo de Desarrollo</td><td>Equipo de Manticore Labs</td></tr>
          </tbody>
        </table>
        <p class="note-small">** Cada uno de los responsables de los distintos &ldquo;Módulos&rdquo; del sistema se irán delimitando mediante se avanza con las reuniones de requerimientos.</p>
        <h3 class="subsection-title subsection-spacing">Responsabilidad del Proveedor</h3>
        <p>La responsabilidad del Product Owner es asegurarse de que están entregando el mayor valor.</p>
        <p>La responsabilidad del Scrum Master es unir todo y garantizar que el proceso de SCRUM se haga bien. En términos prácticos, eso significa que ayudan al product owner a definir el valor, al equipo de desarrollo a entregar el valor y al equipo de scrum a mejorar.</p>
        <p>La responsabilidad del equipo de desarrollo es llevar a cabo el desarrollo, implementación y despliegue del aplicativo, así cómo la solución de cualquier tipo de errores que se tenga.</p>
      </div>
      ${docFooter(5)}
    </section>

    <section class="page page-standard page-compact">
      <div class="page-inner page-inner-standard">
        <h3 class="subsection-title">Responsabilidad del Cliente</h3>
        <p>Los responsables de cada uno de los módulos tienen la responsabilidad de aprobar y revisar los requerimientos del sistema. En el caso de modificaciones se evaluará si se necesita una redefinición del alcance del sistema. Es importante que se intenten definir bien los requerimientos y sacar todos los flujos al principio del desarrollo ya que el costo del cambio se va incrementando mientras va avanzando el proyecto.</p>
        <p>El siguiente gráfico demuestra que mientras se descubren cambios en las primeras etapas del desarrollo del sistema serán mucho menos costosos de implementar. Dentro del proyecto se tendrá cómo referencia los requerimientos levantados durante las primeras sesiones de trabajo para la elaboración del contrato. En el caso de haber requerimientos aprobados y estén en etapas de desarrollo, pruebas o despliegue se evaluará si estos cambios pueden ser implementados sin costos adicionales o con costos adicionales, la responsabilidad será de cada uno de los responsables del módulo.</p>
        <figure class="content-figure figure-medium figure-bottom">
          <img src="${assets["imagen4.png"]}" alt="Diagrama de costo del cambio">
          <figcaption><strong>Imagen 4 -</strong> Diagrama de costo del cambio</figcaption>
        </figure>
      </div>
      ${docFooter(6)}
    </section>`;
}

function buildDynamicFlow(blocks: PropuestaBlock[]): string {
  const inner = blocksToHtml(filterDynamicContentBlocks(blocks), false);
  if (!inner.trim()) return "";

  return `
    <div class="proposal-flow page-standard">
${inner}
    </div>
    <div class="flow-print-footer" aria-hidden="true">
      <a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a>
    </div>`;
}

export function buildLiteralCorporateHtml(
  cover: CorporateCover,
  blocks: PropuestaBlock[],
  assets: Record<AssetName, string>,
): string {
  const parsed = parseProposalFromBlocks(blocks, cover);
  const fixedPages = buildFixedPages(
    cover,
    assets,
    parsed.objetivos,
    parsed.scrumMaster,
    parsed.qaResponsable,
  );
  const dynamicFlow = buildDynamicFlow(blocks);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manticore Labs - Propuesta ${esc(cover.name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${CORPORATE_CSS}</style>
  <style>${PROPOSAL_FLOW_CSS}</style>
</head>
<body>
  <main class="document">
${fixedPages}
${dynamicFlow}
  </main>
</body>
</html>`;
}
