/**
 * Generador de HTML corporativo usando DeepSeek.
 *
 * Flujo:
 *   1. Recibe bloques de Notion y los convierte a HTML literal (blocksToHtml).
 *   2. Envia a DeepSeek el contenido + un ejemplo HTML de referencia.
 *   3. DeepSeek organiza el contenido en paginas HTML corporativas (794x1122px).
 *   4. Se verifican datos: todo texto de Notion debe aparecer en la salida.
 *   5. Se reemplazan placeholders de imagenes por base64 reales.
 *
 * Si DeepSeek falla o la verificacion no pasa, se usa el fallback literal.
 */
import { CORPORATE_CSS } from "./corporate-css";
import { blocksToHtml, type PropuestaBlock } from "./html";
import type { CorporateCover } from "./corporate-types";
import type { AssetName } from "./assets";

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function esc(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const IMAGE_PLACEHOLDERS: Record<string, AssetName> = {
  "{{IMAGE_LOGO}}": "manticorelogoazul.png",
  "{{IMAGE_LOGO_FULL}}": "manticore-logo-full.png",
  "{{IMAGE_1}}": "imagen1.png",
  "{{IMAGE_2}}": "imagen2.png",
  "{{IMAGE_3}}": "imagen3.png",
  "{{IMAGE_4}}": "imagen4.png",
};

const PAGINATION_SAFETY_CSS = `
/* Reglas de seguridad anti-corte - se inyectan siempre */
.page-standard.page-dynamic {
  height: auto;
  min-height: 1122px;
  overflow: visible;
  page-break-inside: auto;
}
.page-standard.page-dynamic .page-inner-standard {
  height: auto;
  min-height: calc(1122px - 36px);
  overflow: visible;
}
table { page-break-inside: auto !important; }
tr { page-break-inside: avoid !important; break-inside: avoid !important; }
thead { display: table-header-group !important; }
p, li { orphans: 3; widows: 3; }
blockquote { page-break-inside: avoid; break-inside: avoid; }
h2, h3 { page-break-after: avoid; break-after: avoid; }
`;

function replaceImagePlaceholders(
  html: string,
  assets: Record<AssetName, string>,
): string {
  let result = html;
  for (const [placeholder, assetName] of Object.entries(IMAGE_PLACEHOLDERS)) {
    result = result.replaceAll(placeholder, assets[assetName] || "");
  }
  return result;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function verifyContentIntegrity(
  notionText: string,
  generatedHtml: string,
): { ok: boolean; missingCount: number } {
  const originalWords = stripHtmlTags(notionText)
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .map((w) => w.toLowerCase().replace(/[.,;:!?()]/g, ""));

  const uniqueWords = [...new Set(originalWords)];
  if (uniqueWords.length === 0) return { ok: true, missingCount: 0 };

  const genLower = generatedHtml.toLowerCase();
  const missing = uniqueWords.filter((w) => !genLower.includes(w));
  const missingRatio = missing.length / uniqueWords.length;

  return { ok: missingRatio < 0.15, missingCount: missing.length };
}

function buildSystemPrompt(): string {
  return `Eres un maquetador HTML corporativo de Manticore Labs. Tu trabajo es tomar el contenido de una propuesta y organizarlo en un documento HTML paginado profesional.

FORMATO DE CADA PAGINA:
Cada pagina es un <section class="page page-standard"> de exactamente 794x1122 pixeles.
Dentro: <div class="page-inner page-inner-standard"> para el contenido.
Al final: <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>NUMERO</span></footer>

ESTRUCTURA OBLIGATORIA DEL DOCUMENTO:
1. Pagina 1 - PORTADA: <section class="page page-cover"> con titulo, codigo, version, fecha, logo {{IMAGE_LOGO}}
2. Pagina 2 - INDICE: tabla con secciones y numeros de pagina
3. Pagina 3 - CITA: <section class="page page-standard page-quote"> con logo {{IMAGE_LOGO_FULL}} y cita de Steve Jobs
4. Paginas 4-6 - METODOLOGIA (SIEMPRE incluir, es texto fijo):
   - Pag 4: Objetivos de la propuesta + "Descripcion y metodologia" + imagen {{IMAGE_1}} + fases (Requerimientos, Diseno, Desarrollo, Pruebas, Despliegue, Operaciones)
   - Pag 5: Continuacion SCRUM + imagen {{IMAGE_2}} + imagen {{IMAGE_3}}
   - Pag 6: Responsabilidad del Proveedor + Responsabilidad del Cliente + imagen {{IMAGE_4}} + inicio del contenido especifico
5. Paginas 7+ - CONTENIDO DE LA PROPUESTA: aqui va el contenido de Notion organizado

CLASES CSS DISPONIBLES:
- section-title: h2 con color dorado (#ffb700)
- subsection-title: h3 negro
- data-table: tablas con bordes y encabezado teal (#25556c)
- content-list: listas ul con bullets
- phase-list: lista de fases con sub-items
- content-figure: figura con imagen y caption
- figure-small / figure-wide: tamanos de imagen
- price-table: tabla de precios con formato especial
- price-main, price-summary, price-total: filas de la tabla de precios
- price-items, price-values: contenido de la tabla de precios
- note-small: nota con asteriscos
- page-compact: clase adicional para paginas con mucho contenido (reduce margenes)
- page-last: padding superior reducido para la ultima pagina
- section-gap-medium: margin-top entre secciones en la misma pagina
- center-cell: celda centrada
- quote-layout, quote-logo, quote-copy, quote-author: para la pagina de cita

IMAGENES (usar estos placeholders exactos como src):
- {{IMAGE_LOGO}}: logo azul de Manticore (portada, esquina inferior derecha, class="cover-logo")
- {{IMAGE_LOGO_FULL}}: logo completo (pagina cita, class="quote-logo")
- {{IMAGE_1}}: proceso integral de desarrollo (figure-small en metodologia)
- {{IMAGE_2}}: metodologia Scrum (figure-wide en SCRUM)
- {{IMAGE_3}}: diagrama Scrum (figure-small)
- {{IMAGE_4}}: diagrama costo del cambio (figure-small)

PAGINACION Y SEGURIDAD ANTI-CORTE:
- Las paginas de contenido (7 en adelante) DEBEN usar class="page page-standard page-dynamic" para que las tablas fluyan sin cortarse.
- Si una tabla no cabe entera en una pagina, el CSS page-dynamic permite que fluya a la siguiente. NO necesitas dividirla manualmente.
- Pero SI la tabla es muy larga (>15 filas), dividela en secciones separadas con <thead> repetido.
- Cada seccion de contenido debe tener su footer con numero de pagina.

REGLAS ABSOLUTAS:
1. PROHIBIDO cambiar, resumir, parafrasear o inventar CUALQUIER texto del contenido. Cada palabra, numero, precio, nombre debe ser IDENTICO al original.
2. PROHIBIDO omitir tablas, filas, columnas, celdas o cualquier dato.
3. PROHIBIDO recalcular precios o montos. Reproducirlos EXACTAMENTE como estan.
4. Adaptar el texto de metodologia al contexto de la propuesta (ej: "desarrollo de modulos" vs "configuracion de variables"), sin inventar datos.
5. El indice (pagina 2) debe reflejar las secciones reales con numeros de pagina estimados.
6. Todas las negritas (**texto**) del original deben ser <strong> en el HTML.
7. Codigo inline (\`texto\`) debe ser <code>.
8. No agregar secciones que no esten en el contenido original (excepto portada, indice, cita y metodologia que son fijas).
9. No omitir blockquotes ni notas del original.

EJEMPLO DE ESTRUCTURA HTML (condensado):

<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Manticore Labs - Propuesta [NOMBRE]</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>{{CORPORATE_CSS}}</style>
</head>
<body>
<main class="document">
  <!-- PAG 1: PORTADA -->
  <section class="page page-cover">
    <div class="page-inner">
      <p class="cover-brand">MANTICORE LABS</p>
      <h1 class="cover-title">[TITULO]</h1>
      <div class="cover-meta">
        <div class="cover-meta-group"><span class="cover-label">Numero referencial:</span><span class="cover-value">[CODIGO]</span></div>
        <div class="cover-meta-group"><span class="cover-label">Version:</span><span class="cover-value">[VERSION]</span></div>
      </div>
      <div class="cover-spacer"></div>
      <div class="cover-contact">
        <p class="cover-contact-title">CONTACTANOS:</p>
        <p><a class="cover-contact-link" href="mailto:info@manticore-labs.com">info@manticore-labs.com</a></p>
        <p class="cover-date">[FECHA]</p>
        <p class="cover-validity">Valido por [N] dias</p>
      </div>
      <img class="cover-logo" src="{{IMAGE_LOGO}}" alt="Logo Manticore">
    </div>
  </section>

  <!-- PAG 2: INDICE -->
  <section class="page page-standard page-index">
    <div class="page-inner page-inner-standard">
      <h2 class="index-title">Indice</h2>
      <table class="index-table"><tbody>
        <tr><td>[Seccion]</td><td>[N]</td></tr>
      </tbody></table>
    </div>
    <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>2</span></footer>
  </section>

  <!-- PAG 3: CITA -->
  <section class="page page-standard page-quote">
    <div class="page-inner page-inner-standard quote-layout">
      <img class="quote-logo" src="{{IMAGE_LOGO_FULL}}" alt="Logo">
      <div class="quote-copy">
        <blockquote>&ldquo;Design is not just what it<br>looks like and feels like.<br>Design is how it works.&rdquo;</blockquote>
        <p class="quote-author">STEVE JOBS</p>
      </div>
    </div>
    <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>3</span></footer>
  </section>

  <!-- PAG 4: METODOLOGIA (con objetivos de la propuesta) -->
  <section class="page page-standard">
    <div class="page-inner page-inner-standard">
      <h2 class="section-title">[Seccion: Resumen o Objetivos del contenido]</h2>
      <!-- Aqui va la primera seccion del contenido de Notion -->
      <h2 class="section-title">Descripcion y metodologia</h2>
      <p>Manticore Labs se va a encargar de [adaptar al contexto de la propuesta], revisando las fases de desarrollo de software y la metodologia que se va a utilizar. La metodologia dentro del equipo de Manticore Labs es SCRUM.</p>
      <figure class="content-figure figure-small">
        <img src="{{IMAGE_1}}" alt="Proceso integral de desarrollo de software">
        <figcaption><strong>Imagen 1 -</strong> Proceso integral de desarrollo de software</figcaption>
      </figure>
    </div>
    <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>4</span></footer>
  </section>

  <!-- PAG 5: SCRUM -->
  <section class="page page-standard">
    <div class="page-inner page-inner-standard">
      <ul class="phase-list">
        <li><strong>Requerimientos</strong><ul><li>Se toman los requerimientos del sistema</li></ul></li>
        <li><strong>Diseno</strong><ul><li>Se evaluan los requerimientos para transformarlos en historias de usuario</li></ul></li>
        <li><strong>Desarrollo</strong><ul><li>Se desarrollan los requisitos</li></ul></li>
        <li><strong>Pruebas</strong><ul><li>Se evalua que cumplan los requerimientos</li></ul></li>
        <li><strong>Despliegue</strong><ul><li>Se envian los cambios a los servidores de pruebas</li></ul></li>
        <li><strong>Operaciones</strong><ul><li>Se revisa que el proceso haya culminado satisfactoriamente</li></ul></li>
      </ul>
      <p>Dentro de la metodologia SCRUM el proceso es levantar los requerimientos, luego ir construyendose en un periodo corto de tiempo para que el cliente pueda validarlos.</p>
      <figure class="content-figure figure-wide figure-top">
        <img src="{{IMAGE_2}}" alt="Metodologia Scrum">
        <figcaption><strong>Imagen 2 -</strong> Metodologia Scrum</figcaption>
      </figure>
      <figure class="content-figure figure-small">
        <img src="{{IMAGE_3}}" alt="Diagrama Scrum">
        <figcaption><strong>Imagen 3 -</strong> Diagrama de costo del cambio</figcaption>
      </figure>
    </div>
    <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>5</span></footer>
  </section>

  <!-- PAG 6: RESPONSABILIDADES + CONTENIDO -->
  <section class="page page-standard">
    <div class="page-inner page-inner-standard">
      <h3 class="subsection-title">Responsabilidad del Proveedor</h3>
      <ul class="content-list">
        <li>[Adaptar al contexto de la propuesta sin inventar]</li>
      </ul>
      <h3 class="subsection-title subsection-spacing">Responsabilidad del Cliente</h3>
      <ul class="content-list">
        <li>[Adaptar al contexto de la propuesta sin inventar]</li>
      </ul>
      <figure class="content-figure figure-small">
        <img src="{{IMAGE_4}}" alt="Diagrama de costo del cambio">
        <figcaption><strong>Imagen 4 -</strong> Diagrama de costo del cambio</figcaption>
      </figure>
      <h2 class="section-title section-gap-medium">[Siguiente seccion del contenido]</h2>
      <!-- Continuar con el contenido de Notion -->
    </div>
    <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>6</span></footer>
  </section>

  <!-- PAG 7+: CONTENIDO (usar page-dynamic para tablas largas) -->
  <section class="page page-standard page-dynamic">
    <div class="page-inner page-inner-standard">
      <h2 class="section-title">[Seccion con tabla grande]</h2>
      <table class="data-table">
        <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>
        <tbody><tr><td>dato</td><td>dato</td></tr></tbody>
      </table>
    </div>
    <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>7</span></footer>
  </section>

  <!-- ULTIMA PAGINA: PRECIOS (si aplica) -->
  <section class="page page-standard page-dynamic">
    <div class="page-inner page-inner-standard page-last">
      <h2 class="section-title">Precios</h2>
      <table class="price-table">
        <thead><tr><th>Descripcion</th><th>Precio</th></tr></thead>
        <tbody>
          <tr class="price-main"><td><ul class="price-items"><li>[item]</li></ul></td><td class="price-values"><div>[monto]</div></td></tr>
          <tr class="price-summary"><td><strong>Subtotal</strong></td><td><strong>[monto]</strong></td></tr>
          <tr class="price-summary"><td><strong>I.V.A. (15%)</strong></td><td><strong>[monto]</strong></td></tr>
          <tr class="price-total"><td><strong>Total</strong></td><td><strong>[monto]</strong></td></tr>
        </tbody>
      </table>
    </div>
    <footer class="doc-footer"><a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>8</span></footer>
  </section>
</main>
</body>
</html>

Genera el HTML COMPLETO siguiendo esta estructura. El CSS se inyectara despues, solo pon <style>{{CORPORATE_CSS}}</style> en el head.`;
}

async function callDeepSeek(
  notionHtml: string,
  cover: CorporateCover,
): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[deepseek-html] DEEPSEEK_API_KEY no configurada.");
    return null;
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  const userPrompt = `Genera el HTML corporativo para esta propuesta.

DATOS DE PORTADA:
- Nombre: ${cover.name}
- Codigo: ${cover.code}
- Version: ${cover.version}
- Fecha: ${cover.fecha}
- Vigencia: ${cover.validezDias} dias

CONTENIDO DE LA PROPUESTA (reproducir IDENTICO, solo organizar en paginas):

${notionHtml}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 16000,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userPrompt.slice(0, 48000) },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[deepseek-html] HTTP ${res.status}`);
      return null;
    }

    const json = (await res.json()) as DeepSeekResponse;
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const htmlMatch = text.match(/<!DOCTYPE[\s\S]*<\/html>/i);
    return htmlMatch ? htmlMatch[0] : text;
  } catch (err) {
    console.warn("[deepseek-html] Error:", err);
    return null;
  }
}

function buildFallbackHtml(
  cover: CorporateCover,
  notionHtml: string,
  assets: Record<AssetName, string>,
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Manticore Labs - Propuesta ${esc(cover.name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${CORPORATE_CSS}</style>
  <style>
    .literal-body { padding: 54px 60px 36px 60px; font-family: "Open Sans", Arial, sans-serif; font-size: 13px; line-height: 1.5; }
    .literal-body h2 { margin: 28px 0 14px; color: var(--deep-gold); font-family: "Montserrat", Arial, sans-serif; font-size: 15px; font-weight: 700; }
    .literal-body h3 { margin: 20px 0 10px; font-size: 13px; font-weight: 700; }
    .literal-body p { margin: 0 0 10px; text-align: justify; }
    .literal-body ul, .literal-body ol { margin: 0 0 12px; padding-left: 24px; }
    .literal-body li { margin-bottom: 5px; }
    .literal-body blockquote { margin: 14px 0; padding: 10px 16px; border-left: 3px solid var(--gold); background: #fbfaf4; }
    .literal-body table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; }
    .literal-body th, .literal-body td { border: 1px solid var(--line); padding: 6px 8px; font-size: 11.5px; line-height: 1.4; vertical-align: top; }
    .literal-body th { background: var(--teal); color: #fff; font-weight: 700; }
    .literal-body tr { break-inside: avoid; }
    .literal-body thead { display: table-header-group; }
    .literal-body hr { border: none; border-top: 1px solid #e0e0e0; margin: 22px 0; }
  </style>
</head>
<body>
  <main class="document">
    <section class="page page-cover">
      <div class="page-inner">
        <p class="cover-brand">MANTICORE LABS</p>
        <h1 class="cover-title">Propuesta &ldquo;${esc(cover.name)}&rdquo;</h1>
        <div class="cover-meta">
          <div class="cover-meta-group"><span class="cover-label">N\u00famero referencial:</span><span class="cover-value">${esc(cover.code)}</span></div>
          <div class="cover-meta-group"><span class="cover-label">Versi\u00f3n:</span><span class="cover-value">${esc(cover.version)}</span></div>
        </div>
        <div class="cover-spacer"></div>
        <div class="cover-contact">
          <p class="cover-contact-title">CONTACTANOS:</p>
          <p><a class="cover-contact-link" href="mailto:info@manticore-labs.com">info@manticore-labs.com</a></p>
          <p class="cover-date">${esc(cover.fecha)}</p>
          <p class="cover-validity">V\u00e1lido por ${esc(cover.validezDias)} d\u00edas</p>
        </div>
        <img class="cover-logo" src="${assets["manticorelogoazul.png"]}" alt="Logo Manticore">
      </div>
    </section>
    <div class="literal-body">
${notionHtml}
    </div>
  </main>
</body>
</html>`;
}

export async function buildSmartCorporateHtml(
  cover: CorporateCover,
  blocks: PropuestaBlock[],
  assets: Record<AssetName, string>,
): Promise<string> {
  const notionHtml = blocksToHtml(blocks, true);

  if (!notionHtml.trim()) {
    console.warn("[deepseek-html] Contenido de Notion vacio, usando fallback.");
    return buildFallbackHtml(cover, notionHtml, assets);
  }

  const generated = await callDeepSeek(notionHtml, cover);

  if (!generated) {
    console.warn("[deepseek-html] DeepSeek no devolvio HTML, usando fallback.");
    return buildFallbackHtml(cover, notionHtml, assets);
  }

  const { ok, missingCount } = verifyContentIntegrity(notionHtml, generated);
  if (!ok) {
    console.warn(
      `[deepseek-html] Verificacion fallo: ${missingCount} palabras clave faltantes. Usando fallback.`,
    );
    return buildFallbackHtml(cover, notionHtml, assets);
  }

  let html = generated;
  html = html.replace("{{CORPORATE_CSS}}", CORPORATE_CSS + PAGINATION_SAFETY_CSS);
  html = replaceImagePlaceholders(html, assets);

  if (!html.includes("fonts.googleapis.com")) {
    html = html.replace(
      "</head>",
      `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">\n</head>`,
    );
  }

  console.log("[deepseek-html] HTML corporativo generado y verificado OK.");
  return html;
}
