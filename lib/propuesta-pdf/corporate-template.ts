/**
 * Constructor del HTML corporativo de la propuesta Manticore Labs.
 * Reproduce fielmente templates/PropuestaActualizacion.html (11 páginas) e inyecta
 * el contenido estructurado + los cálculos financieros. Las columnas de las tablas
 * y los bloques fijos NO cambian; solo se rellenan filas y marcadores.
 */
import { CORPORATE_CSS } from "./corporate-css";
import { formatMoney } from "./calc";
import type { AssetName } from "./assets";
import type {
  CorporateFinancials,
  CorporateProposalContent,
} from "./corporate-types";
import { ACTIVITY_ORDER } from "./calc";

function esc(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtWeeks(n: number): string {
  return String(n);
}

function objetivosHtml(objetivos: string[]): string {
  const items = objetivos.length ? objetivos : ["Cubrir los requerimientos funcionales solicitados por el cliente."];
  return items.map((o) => `<li>${esc(o)}</li>`).join("\n");
}

function solutionsRows(content: CorporateProposalContent): string {
  const mods = content.modulos.length
    ? content.modulos
    : [{ nombre: "Módulo principal", complejidad: "Medio" as const, descripcion: "Funcionalidad central del sistema.", funcionalidades: ["Gestión de datos"] }];
  return mods
    .map((m) => {
      const bullets = (m.funcionalidades.length ? m.funcionalidades : ["Funcionalidad principal"])
        .map((f) => `<li>${esc(f)}</li>`)
        .join("\n");
      return `<tr>
  <td><strong>${esc(m.nombre)}</strong></td>
  <td>${esc(m.complejidad)}</td>
  <td>${esc(m.descripcion)}</td>
  <td>
    <ul class="table-bullets">
${bullets}
    </ul>
  </td>
</tr>`;
    })
    .join("\n");
}

function personalRows(content: CorporateProposalContent): string {
  const roles = content.personal.length
    ? content.personal
    : [{ rol: "Arquitecto de Solución / PM", cantidad: 1, descripcion: "Gestión del proyecto y definición de arquitectura." }];
  return roles
    .map(
      (p) => `<tr>
  <td><strong>${esc(p.rol)}</strong></td>
  <td class="center-cell">${esc(p.cantidad)}</td>
  <td>${esc(p.descripcion)}</td>
</tr>`
    )
    .join("\n");
}

function activitiesRows(content: CorporateProposalContent, fin: CorporateFinancials): string {
  return ACTIVITY_ORDER.map((nombre, i) => {
    const act = content.actividades[i];
    const semanas = act?.semanas ?? 0;
    const horas = fin.actividadesHoras[i];
    const desc = act?.descripcion ?? "";
    return `<tr>
  <td><strong>${esc(nombre)}</strong></td>
  <td>${esc(desc)}</td>
  <td>${fmtWeeks(semanas)} semana${semanas === 1 ? "" : "s"}</td>
  <td>${horas} h</td>
</tr>`;
  }).join("\n");
}

function requirementsRows(content: CorporateProposalContent): string {
  const reqs = content.requerimientos.length
    ? content.requerimientos
    : [{ nombre: "Requerimiento principal", descripcion: "Funcionalidad central del sistema.", tiempo: "1–2 semanas" }];
  return reqs
    .map((r, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `<tr>
  <td class="center-cell"><strong>${num}</strong></td>
  <td><strong>${esc(r.nombre)}</strong></td>
  <td>${esc(r.descripcion)}</td>
  <td class="center-cell">${esc(r.tiempo)}</td>
</tr>`;
    })
    .join("\n");
}

function paymentsHtml(fin: CorporateFinancials): string {
  return fin.pagos
    .map(
      (p) => `<li>
  <span>Fase ${p.fase} - ${esc(p.hito)}</span>
  <ul>
    <li>Se debe pagar el ${p.porcentaje}% con un monto total de $${esc(p.monto)} sin IVA.</li>
  </ul>
</li>`
    )
    .join("\n");
}

export function buildCorporateHtml(
  content: CorporateProposalContent,
  fin: CorporateFinancials,
  assets: Record<AssetName, string>
): string {
  const c = content.cover;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manticore Labs - Propuesta ${esc(c.name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${CORPORATE_CSS}</style>
</head>
<body>
  <main class="document">

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
            <tr><td>Requerimientos y tiempos</td><td>9</td></tr>
            <tr><td>Tiempos y costos de la solución</td><td>10</td></tr>
            <tr><td>Nota</td><td>11</td></tr>
            <tr><td>Forma de pago</td><td>12</td></tr>
            <tr><td>Conclusiones</td><td>12</td></tr>
          </tbody>
        </table>
      </div>
      <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>2</span></footer>
    </section>

    <section class="page page-standard page-quote">
      <div class="page-inner page-inner-standard quote-layout">
        <img class="quote-logo" src="${assets["manticore-logo-full.png"]}" alt="Logo de Manticore Labs">
        <div class="quote-copy">
          <blockquote>&ldquo;Design is not just what it<br>looks like and feels like.<br>Design is how it works.&rdquo;</blockquote>
          <p class="quote-author">STEVE JOBS</p>
        </div>
      </div>
      <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>3</span></footer>
    </section>

    <section class="page page-standard page-compact">
      <div class="page-inner page-inner-standard">
        <h2 class="section-title">Objetivos</h2>
        <ul class="content-list">
${objetivosHtml(content.objetivos)}
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
      <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>4</span></footer>
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
            <tr><td>Scrum Master</td><td>${esc(content.scrumMaster || "Manticore Labs")}</td></tr>
            <tr><td>QA</td><td>${esc(content.qaResponsable || "Manticore Labs")}</td></tr>
            <tr><td>Equipo de Desarrollo</td><td>Equipo de Manticore Labs</td></tr>
          </tbody>
        </table>
        <p class="note-small">** Cada uno de los responsables de los distintos &ldquo;Módulos&rdquo; del sistema se irán delimitando mediante se avanza con las reuniones de requerimientos.</p>
        <h3 class="subsection-title subsection-spacing">Responsabilidad del Proveedor</h3>
      </div>
      <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>5</span></footer>
    </section>

    <section class="page page-standard page-compact">
      <div class="page-inner page-inner-standard">
        <p>La responsabilidad del Product Owner es asegurarse de que están entregando el mayor valor.</p>
        <p>La responsabilidad del Scrum Master es unir todo y garantizar que el proceso de SCRUM se haga bien. En términos prácticos, eso significa que ayudan al product owner a definir el valor, al equipo de desarrollo a entregar el valor y al equipo de scrum a mejorar.</p>
        <p>La responsabilidad del equipo de desarrollo es llevar a cabo el desarrollo, implementación y despliegue del aplicativo, así cómo la solución de cualquier tipo de errores que se tenga.</p>
        <h3 class="subsection-title">Responsabilidad del Cliente</h3>
        <p>Los responsables de cada uno de los módulos tienen la responsabilidad de aprobar y revisar los requerimientos del sistema. En el caso de modificaciones se evaluará si se necesita una redefinición del alcance del sistema. Es importante que se intenten definir bien los requerimientos y sacar todos los flujos al principio del desarrollo ya que el costo del cambio se va incrementando mientras va avanzando el proyecto.</p>
        <p>El siguiente gráfico demuestra que mientras se descubren cambios en las primeras etapas del desarrollo del sistema serán mucho menos costosos de implementar. Dentro del proyecto se tendrá cómo referencia los requerimientos levantados durante las primeras sesiones de trabajo para la elaboración del contrato. En el caso de haber requerimientos aprobados y estén en etapas de desarrollo, pruebas o despliegue se evaluará si estos cambios pueden ser implementados sin costos adicionales o con costos adicionales, la responsabilidad será de cada uno de los responsables del módulo.</p>
        <figure class="content-figure figure-medium figure-bottom">
          <img src="${assets["imagen4.png"]}" alt="Diagrama de costo del cambio">
          <figcaption><strong>Imagen 4 -</strong> Diagrama de costo del cambio</figcaption>
        </figure>
      </div>
      <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>6</span></footer>
    </section>

    <section class="page page-standard">
      <div class="page-inner page-inner-standard">
        <h2 class="section-title">Descripción de la solución</h2>
        <table class="data-table data-table-solutions">
          <thead><tr><th>Módulo</th><th>Complejidad</th><th>Descripción</th><th>Funcionalidades principales</th></tr></thead>
          <tbody>
${solutionsRows(content)}
          </tbody>
        </table>
      </div>
      <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>7</span></footer>
    </section>

    <section class="page page-standard page-compact">
      <div class="page-inner page-inner-standard">
        <h2 class="section-title">Personal</h2>
        <p>El personal requerido para las diferentes fases del proyecto, son necesarios ya que se maneja entregas parciales del proyecto, estas entregas son ITERATIVAS incrementales, por lo cual en cada fase cada miembro del equipo realiza partes fundamentales para realizar las entregas a tiempo, con la calidad necesaria.</p>
        <table class="data-table data-table-personal">
          <thead><tr><th>Rol</th><th>Cantidad</th><th>Descripción del Rol</th></tr></thead>
          <tbody>
${personalRows(content)}
          </tbody>
        </table>

        <p class="note-inline"><strong>NOTA:</strong> Manticore Labs no se responsabiliza por despliegues ni problemas presentados en ambientes del cliente. En caso de tener un flujo DevOps Manticore Labs brindará los comandos para levantar el aplicativo pero no será responsable de implementar nuevos flujos ni tampoco de problemas de ambiente que se tengan durante el despliegue. Manticore Labs es responsable del código y lógica de negocio escrita en el mismo.</p>
        <h2 class="section-title section-gap-medium">Actividades</h2>
        <table class="data-table data-table-activities">
          <thead><tr><th>Actividad</th><th>Descripción</th><th>Tiempo estimado</th><th>Tiempo estimado (horas)</th></tr></thead>
          <tbody>
${activitiesRows(content, fin)}
          </tbody>
        </table>
      </div>
      <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>8</span></footer>
    </section>

    <section class="page page-standard">
      <div class="page-inner page-inner-standard">
        <h2 class="section-title">Requerimientos y tiempos</h2>
        <table class="data-table data-table-requirements">
          <thead><tr><th>#</th><th>Requerimiento</th><th>Descripción</th><th>Tiempo</th></tr></thead>
          <tbody>
${requirementsRows(content)}
          </tbody>
        </table>
      </div>
      <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>9</span></footer>
    </section>

    <section class="page page-standard">
      <div class="page-inner page-inner-standard">
        <h2 class="section-title">Tiempos y costos de la solución</h2>
        <p>Las etapas de la solución son:</p>
        <table class="data-table data-table-stages">
          <thead><tr><th>Etapas</th><th>Tiempo estimado</th><th>Detalle</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>Desarrollo, entrega y pruebas continuas</strong></td>
              <td><strong>${fin.horasDesarrollo} horas</strong></td>
              <td>Desarrollo de funciones previamente aprobadas en actas e historias de usuario.</td>
            </tr>
            <tr>
              <td><strong>Revisión</strong></td>
              <td><strong>${fin.horasUat} horas</strong></td>
              <td>Revisión en ambiente de pre-producción.</td>
            </tr>
          </tbody>
        </table>
        <p>Se estima que la fecha de entrega será de ${fin.totalHoras} horas a partir de la aprobación por parte del cliente.</p>

        <table class="price-table">
          <thead><tr><th>Descripción</th><th>Precio</th></tr></thead>
          <tbody>
            <tr class="price-main">
              <td>
                <ul class="price-items">
                  <li><strong>Desarrollo de la solución</strong></li>
                  <li><strong>Pruebas</strong></li>
                </ul>
              </td>
              <td class="price-values">
                <div>$${formatMoney(fin.precioDesarrollo)}</div>
                <div>$${formatMoney(fin.precioPruebas)}</div>
              </td>
            </tr>
            <tr class="price-summary"><td><strong>Subtotal</strong></td><td><strong>$${formatMoney(fin.subtotal)}</strong></td></tr>
            <tr class="price-summary"><td><strong>I.V.A.</strong></td><td><strong>$${formatMoney(fin.iva)}</strong></td></tr>
            <tr class="price-total"><td><strong>Total</strong></td><td><strong>$${formatMoney(fin.total)}</strong></td></tr>
          </tbody>
        </table>
        <p class="price-note">** NO INCLUYE MODIFICACIONES DE REQUERIMIENTOS</p>
      </div>
      <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>10</span></footer>
    </section>

    <section class="page page-standard page-compact">
      <div class="page-inner page-inner-standard">
        <h2 class="section-title">Nota</h2>
        <p>Se establecerá un límite de tiempo posterior a la entrega y notificación de finalización para que el cliente realice la validación y/o despliegue correspondiente.</p>
        <ul class="content-list">
          <li>Una vez transcurrido este tiempo, se considerará el trabajo como finalizado.</li>
          <li>En caso de que el cliente no realice pruebas o despliegues dentro del plazo definido, las horas adicionales de soporte, revisión o validación serán facturadas como servicio adicional.</li>
          <li>Se aclara que cualquier mal uso del sistema o configuraciones incorrectas realizadas por el cliente, que requieran soporte adicional, serán también facturadas.</li>
          <li>Todo tiempo invertido en revisiones o atención de incidencias fuera del alcance de la entrega será contabilizado y cobrado.</li>
        </ul>
        <p class="clause-block">Todo cambio estructural o de datos en la base de datos deberá implementarse a través de migraciones versionadas entregadas por Manticore Labs. El cliente es responsable de ejecutar dichas migraciones en sus ambientes (QA y Producción) siguiendo los comandos y el orden provistos por Manticore. Queda estrictamente prohibido el uso de scripts manuales de base de datos fuera de este flujo. Cualquier modificación directa a la base de datos realizada sin este proceso, ya sea por el cliente o por terceros, libera a Manticore Labs de responsabilidad sobre los errores derivados y será atendida bajo soporte facturable.</p>
        <p class="clause-block">El alcance de la garantía de Manticore Labs cubre únicamente los defectos reproducibles en el ambiente de QA del cliente, donde Manticore Labs realiza sus pruebas de entrega antes de cada despliegue. Si una funcionalidad opera correctamente en dicho ambiente y presenta fallas en el ambiente de producción del cliente, Manticore Labs realizará una revisión inicial para determinar el origen del problema. Si se determina que la causa es el ambiente, los datos, la configuración o la operación realizada en producción por el cliente, la atención continua tendrá costo según el tarifario vigente.</p>
        <p>Esta cláusula busca evitar reprocesos innecesarios, optimizar el uso del tiempo del equipo y garantizar la correcta gestión del sistema por parte del cliente.</p>
      </div>
      <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>11</span></footer>
    </section>

    <section class="page page-standard page-compact page-final">
      <div class="page-inner page-inner-standard page-last">
        <h2 class="section-title">Forma de pago</h2>
        <ul class="payment-list">
${paymentsHtml(fin)}
        </ul>
        <h2 class="section-title section-gap-medium">Conclusiones</h2>
        <ul class="content-list">
          <li>Se ha definido la descripción de la solución y la propuesta para llevar a cabo los requerimientos solicitados.</li>
          <li>La propuesta está alineada a los requerimientos levantados y a las lecciones aprendidas de proyectos similares.</li>
          <li>El costo puede variar si cambia el alcance (Change Request) o si cambian los contratos de API o dependencias externas.</li>
        </ul>
      </div>
      <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>12</span></footer>
    </section>

  </main>
</body>
</html>`;
}
