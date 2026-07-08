/**
 * Parser determinista que extrae CorporateProposalContent directamente de los
 * bloques de Notion SIN usar IA. Solo devuelve datos que realmente existen en
 * la pagina; nunca inventa ni "deduce" contenido faltante.
 *
 * Reemplaza a deepseek-propuesta-pdf.ts en el flujo de generacion de PDF.
 */
import type {
  Complejidad,
  CorporateActivity,
  CorporateCover,
  CorporateFinancials,
  CorporateModule,
  CorporatePago,
  CorporatePersonal,
  CorporateProposalContent,
  CorporateRequirement,
} from "./corporate-types";
import type { PropuestaBlock } from "./html";
import { blocksToHtml } from "./html";
import { ACTIVITY_ORDER, formatMoney } from "./calc";

type RichTextSpan = { plain_text?: string };

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cellText(cell: unknown[]): string {
  return cell.map((rt) => (rt as RichTextSpan).plain_text ?? "").join("").trim();
}

function blockText(block: PropuestaBlock): string {
  const data = block[block.type] as { rich_text?: RichTextSpan[] } | undefined;
  return (data?.rich_text ?? []).map((rt) => rt.plain_text ?? "").join("").trim();
}

// ---------------------------------------------------------------------------
// Section splitting
// ---------------------------------------------------------------------------

interface Section {
  heading: string;
  blocks: PropuestaBlock[];
}

function splitIntoSections(blocks: PropuestaBlock[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { heading: "", blocks: [] };

  for (const block of blocks) {
    if (block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3") {
      if (current.heading || current.blocks.length > 0) {
        sections.push(current);
      }
      current = { heading: blockText(block), blocks: [] };
    } else {
      current.blocks.push(block);
    }
  }
  if (current.heading || current.blocks.length > 0) {
    sections.push(current);
  }
  return sections;
}

function findSection(sections: Section[], ...keywords: string[]): Section | undefined {
  return sections.find((s) => {
    const n = normalize(s.heading);
    return keywords.some((k) => n.includes(k));
  });
}

function sectionToHtml(section: Section | undefined): string {
  if (!section) return "";
  const blocks: PropuestaBlock[] = section.heading
    ? [
        {
          type: "heading_2",
          heading_2: { rich_text: [{ plain_text: section.heading }] },
        },
        ...section.blocks,
      ]
    : section.blocks;
  return blocksToHtml(blocks);
}

function parseSectionHtmls(
  sections: Section[]
): Pick<
  CorporateProposalContent,
  "entregablesHtml" | "actividadesHtml" | "formaPagoHtml" | "seccionesExtrasHtml"
> {
  const entregables = findSection(sections, "entregable");
  const actividades = findSection(sections, "actividad");
  const formaPago = findSection(sections, "forma de pago", "pago");

  const seccionesExtras: Array<{ heading: string; html: string }> = [];
  for (const s of sections) {
    const n = normalize(s.heading);
    if (!s.heading) continue;
    if (n.includes("entregable")) continue;
    if (n.includes("modelo de datos") || n.includes("definicion del modelo")) {
      seccionesExtras.push({ heading: s.heading, html: sectionToHtml(s) });
    }
  }

  return {
    entregablesHtml: entregables ? sectionToHtml(entregables) : undefined,
    actividadesHtml: actividades ? sectionToHtml(actividades) : undefined,
    formaPagoHtml: formaPago ? sectionToHtml(formaPago) : undefined,
    seccionesExtrasHtml: seccionesExtras.length > 0 ? seccionesExtras : undefined,
  };
}

// ---------------------------------------------------------------------------
// Table parsing
// ---------------------------------------------------------------------------

interface ParsedTable {
  headers: string[];
  norm: string[];
  rows: string[][];
}

function parseTables(blocks: PropuestaBlock[]): ParsedTable[] {
  const out: ParsedTable[] = [];
  for (const block of blocks) {
    if (block.type !== "table" || !block.__rows || block.__rows.length < 2) continue;
    const td = block.table as { has_column_header?: boolean } | undefined;
    const hasHeader = td?.has_column_header ?? true;
    const all = block.__rows.map((r) => r.cells.map((c) => cellText(c as unknown[])));
    if (!hasHeader || all.length < 2) continue;
    out.push({
      headers: all[0],
      norm: all[0].map(normalize),
      rows: all.slice(1),
    });
  }
  return out;
}

function col(norm: string[], ...kw: string[]): number {
  return norm.findIndex((h) => kw.some((k) => h.includes(k)));
}

// ---------------------------------------------------------------------------
// Bullet list extraction
// ---------------------------------------------------------------------------

function extractBullets(blocks: PropuestaBlock[]): string[] {
  const items: string[] = [];
  for (const b of blocks) {
    if (b.type === "bulleted_list_item" || b.type === "numbered_list_item") {
      const t = blockText(b);
      if (t) items.push(t);
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Complejidad normalization
// ---------------------------------------------------------------------------

const COMPLEJIDADES: Complejidad[] = ["Simple", "Medio", "Medio-alto", "Complejo"];

function normComplejidad(raw: string): Complejidad {
  const s = normalize(raw);
  const exact = COMPLEJIDADES.find((c) => normalize(c) === s);
  if (exact) return exact;
  if (s.includes("alto") || s.includes("complej")) return "Complejo";
  if (s.includes("medio")) return "Medio";
  if (s.includes("simple") || s.includes("bajo")) return "Simple";
  return "Medio";
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

function parseObjetivos(sections: Section[]): string[] {
  const s = findSection(sections, "objetivo");
  if (!s) return [];
  const bullets = extractBullets(s.blocks);
  if (bullets.length > 0) return bullets;
  return s.blocks
    .filter((b) => b.type === "paragraph")
    .map((b) => blockText(b))
    .filter(Boolean);
}

function parseModulos(sections: Section[]): CorporateModule[] {
  const s = findSection(sections, "solucion", "modulo");
  if (!s) return [];
  const tables = parseTables(s.blocks);
  if (tables.length === 0) return [];
  const t = tables[0];

  const iNom = col(t.norm, "modulo", "nombre", "componente");
  const iComp = col(t.norm, "complejidad");
  const iDesc = col(t.norm, "descripcion");
  const iFunc = col(t.norm, "funcionalidad", "caracteristica", "feature");
  if (iNom < 0) return [];

  return t.rows
    .filter((r) => (r[iNom] ?? "").trim())
    .map((r) => ({
      nombre: r[iNom].trim(),
      complejidad: iComp >= 0 ? normComplejidad(r[iComp] ?? "") : ("Medio" as Complejidad),
      descripcion: iDesc >= 0 ? (r[iDesc] ?? "").trim() : "",
      funcionalidades:
        iFunc >= 0
          ? (r[iFunc] ?? "")
              .split(/\n|[;•]/)
              .map((l) => l.replace(/^[-*]\s*/, "").trim())
              .filter(Boolean)
          : [],
    }));
}

function parsePersonal(sections: Section[]): CorporatePersonal[] {
  const s = findSection(sections, "personal");
  if (!s) return [];
  const tables = parseTables(s.blocks);
  if (tables.length === 0) return [];
  const t = tables[0];

  const iRol = col(t.norm, "rol", "cargo", "perfil");
  const iCant = col(t.norm, "cantidad", "cant", "qty");
  const iDesc = col(t.norm, "descripcion");
  if (iRol < 0) return [];

  return t.rows
    .filter((r) => (r[iRol] ?? "").trim())
    .map((r) => ({
      rol: r[iRol].trim(),
      cantidad: iCant >= 0 ? parseInt(r[iCant] ?? "1", 10) || 1 : 1,
      descripcion: iDesc >= 0 ? (r[iDesc] ?? "").trim() : "",
    }));
}

/**
 * Palabras clave para emparejar filas de la tabla de actividades con las 9
 * actividades fijas de ACTIVITY_ORDER.
 */
const ACTIVITY_KEYWORDS: string[][] = [
  ["requerimiento", "mockup", "toma"],
  ["diseno tecnico", "arquitectura", "diseno"],
  ["backend", "logica de negocio", "servidor"],
  ["frontend", "interfaz", "ui"],
  ["unitaria", "unit test", "prueba funcional"],
  ["uat", "aceptacion", "usuario"],
  ["despliegue", "deploy", "produccion"],
  ["capacitacion", "training", "entrenamiento"],
  ["documentacion", "entrega", "cierre"],
];

function matchActivityIndex(text: string): number {
  const n = normalize(text);
  for (let i = 0; i < ACTIVITY_KEYWORDS.length; i++) {
    if (ACTIVITY_KEYWORDS[i].some((kw) => n.includes(kw))) return i;
  }
  return -1;
}

function parseSemanas(raw: string): number {
  const cleaned = raw.replace(/semanas?/gi, "").replace(",", ".").trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseHoras(raw: string): number | undefined {
  const m = raw.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

function parseMoney(raw: string): number | undefined {
  const cleaned = raw.replace(/[$\s]/g, "").replace(/,/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

function activityColumns(t: ParsedTable): { iDesc: number; iSem: number; iHoras: number; iAct: number } {
  const iHorasExplicit = t.norm.findIndex((h) => h.includes("hora"));
  const iTiempo = t.norm.findIndex((h) => h.includes("tiempo"));
  let iHoras = iHorasExplicit;
  let iSem = -1;

  if (iHoras < 0 && iTiempo >= 0) {
    const sample = t.rows
      .slice(0, 4)
      .map((r) => r[iTiempo] ?? "")
      .join(" ");
    if (/\d\s*h\b|\d+\s*horas?/i.test(sample)) {
      iHoras = iTiempo;
    } else {
      iSem = iTiempo;
    }
  }

  if (iHoras >= 0) {
    iSem = t.norm.findIndex((h, idx) => idx !== iHoras && h.includes("semana"));
  } else if (iSem < 0) {
    iSem = t.norm.findIndex((h) => h.includes("semana"));
  }

  return {
    iAct: col(t.norm, "actividad", "fase", "etapa", "nombre"),
    iDesc: col(t.norm, "descripcion", "detalle"),
    iSem,
    iHoras,
  };
}

function mapActivityRow(r: string[], cols: ReturnType<typeof activityColumns>): CorporateActivity {
  return {
    descripcion: cols.iDesc >= 0 ? (r[cols.iDesc] ?? "").trim() : "",
    semanas: cols.iSem >= 0 ? parseSemanas(r[cols.iSem] ?? "") : 0,
    horas: cols.iHoras >= 0 ? parseHoras(r[cols.iHoras] ?? "") : undefined,
  };
}

function parseActividades(sections: Section[]): CorporateActivity[] {
  const s = findSection(sections, "actividad");
  const result: CorporateActivity[] = ACTIVITY_ORDER.map(() => ({
    descripcion: "",
    semanas: 0,
  }));
  if (!s) return result;

  const tables = parseTables(s.blocks);
  if (tables.length === 0) return result;
  const t = tables[0];
  const cols = activityColumns(t);

  if (t.rows.length === 9) {
    return t.rows.map((r) => mapActivityRow(r, cols));
  }

  const nameCol = cols.iAct >= 0 ? cols.iAct : 0;
  for (const r of t.rows) {
    const idx = matchActivityIndex(r[nameCol] ?? "");
    if (idx >= 0) {
      const mapped = mapActivityRow(r, cols);
      result[idx] = {
        descripcion: mapped.descripcion || (r[nameCol] ?? "").trim(),
        semanas: mapped.semanas,
        horas: mapped.horas,
      };
    }
  }
  return result;
}

function parseRequerimientos(sections: Section[]): CorporateRequirement[] {
  const s = findSection(sections, "requerimiento");
  if (!s) return [];
  const tables = parseTables(s.blocks);
  if (tables.length === 0) return [];
  const t = tables[0];

  const iNum = col(t.norm, "#", "numero", "no.");
  const iNom = col(t.norm, "requerimiento", "nombre", "modulo");
  const iDesc = col(t.norm, "descripcion", "detalle");
  const iTiempo = col(t.norm, "tiempo", "semana", "duracion", "plazo");

  const nameCol = iNom >= 0 ? iNom : iNum >= 0 ? iNum + 1 : 0;

  return t.rows
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => ({
      nombre: (r[nameCol] ?? "").trim(),
      descripcion: iDesc >= 0 ? (r[iDesc] ?? "").trim() : "",
      tiempo: iTiempo >= 0 ? (r[iTiempo] ?? "").trim() : "",
    }))
    .filter((req) => req.nombre);
}

function findRoleInTables(
  sections: Section[],
  blocks: PropuestaBlock[],
  ...keywords: string[]
): string {
  const search = (tableBlocks: PropuestaBlock[]) => {
    for (const b of tableBlocks) {
      if (b.type !== "table" || !b.__rows) continue;
      for (const row of b.__rows) {
        const key = normalize(cellText(row.cells[0] as unknown[]));
        if (keywords.some((k) => key.includes(k))) {
          const val = cellText(row.cells[1] as unknown[]);
          if (val) return val;
        }
      }
    }
    return "";
  };

  for (const s of sections) {
    const found = search(s.blocks);
    if (found) return found;
  }
  return search(blocks) || "Manticore Labs";
}

function parseFinancials(sections: Section[], blocks: PropuestaBlock[]): Partial<CorporateFinancials> {
  const s = findSection(sections, "tiempo", "costo");
  const out: Partial<CorporateFinancials> = {};
  const searchBlocks = s?.blocks ?? blocks;
  const tables = parseTables(searchBlocks);

  for (const t of tables) {
    const joined = t.norm.join(" ");
    const isStages = joined.includes("etapa") || t.rows.some((r) => normalize(r[0] ?? "").includes("desarrollo"));
    const isPrice =
      joined.includes("precio") ||
      t.rows.some((r) => {
        const label = normalize(r[0] ?? "");
        return label.includes("subtotal") || label.includes("desarrollo de la solucion");
      });

    if (isStages && !isPrice) {
      const iTiempo = col(t.norm, "tiempo", "hora", "estimado");
      const iEtapas = col(t.norm, "etapa", "fase");
      const timeCol = iTiempo >= 0 ? iTiempo : 1;
      const labelCol = iEtapas >= 0 ? iEtapas : 0;
      for (const r of t.rows) {
        const label = normalize(r[labelCol] ?? "");
        const horas = parseHoras(r[timeCol] ?? "");
        if (!horas) continue;
        if (label.includes("desarrollo") || label.includes("entrega")) out.horasDesarrollo = horas;
        if (label.includes("revision") || label.includes("revisión")) out.horasUat = horas;
      }
    }

    if (isPrice) {
      for (const r of t.rows) {
        const label = normalize(r[0] ?? "");
        const amount = parseMoney(r[1] ?? r[r.length - 1] ?? "");
        if (!amount) continue;
        if (label.includes("desarrollo de la solucion")) out.precioDesarrollo = amount;
        else if (label === "pruebas" || (label.includes("prueba") && !label.includes("unitaria")))
          out.precioPruebas = amount;
        else if (label.includes("subtotal")) out.subtotal = amount;
        else if (label.includes("iva") || label.includes("i.v.a")) out.iva = amount;
        else if (label === "total") out.total = amount;
      }
    }
  }

  for (const block of searchBlocks) {
    if (block.type !== "paragraph") continue;
    const text = blockText(block);
    const m = text.match(/(\d+)\s*horas?\s+a partir de la aprobaci[oó]n/i);
    if (m) out.totalHoras = parseInt(m[1], 10);
    const effort = text.match(/esfuerzo total estimado.*?(\d+)\s*h/i);
    if (effort) out.totalHoras = parseInt(effort[1], 10);
  }

  if (out.horasDesarrollo != null && out.horasUat != null && out.totalHoras == null) {
    out.totalHoras = out.horasDesarrollo + out.horasUat;
  }

  return out;
}

function collectBlockText(blocks: PropuestaBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    const t = blockText(b);
    if (t) parts.push(t);
    if (b.__children?.length) parts.push(collectBlockText(b.__children));
  }
  return parts.join("\n");
}

function parsePagos(sections: Section[]): CorporatePago[] {
  const s = findSection(sections, "forma de pago", "pago");
  if (!s) return [];

  const pagos: CorporatePago[] = [];

  for (const block of s.blocks) {
    if (block.type !== "bulleted_list_item" && block.type !== "numbered_list_item") continue;
    const topText = blockText(block);
    const faseMatch = topText.match(/fase\s*(\d+)/i);
    if (!faseMatch) continue;

    const fase = parseInt(faseMatch[1], 10);
    const hitoFromTitle = topText
      .match(/fase\s*\d+\s*[-–]\s*(.+)/i)?.[1]
      ?.replace(/\*+/g, "")
      .trim();

    let hito = hitoFromTitle || "Hito de pago";
    let condicionPago = "";
    const entregables: string[] = [];
    let mode: "hito" | "entregables" | "condicion" | null = null;

    const walkChildren = (items: PropuestaBlock[]) => {
      for (const child of items) {
        const t = blockText(child);
        const n = normalize(t);
        if (/^hito\b/.test(n)) {
          mode = "hito";
          const hitoVal = t.replace(/^\*?\*?hito:?\*?\*?\s*/i, "").trim();
          if (hitoVal) hito = hitoVal;
          if (child.__children?.length) walkChildren(child.__children);
          continue;
        }
        if (n.includes("entregables asociados")) {
          mode = "entregables";
          if (child.__children?.length) walkChildren(child.__children);
          continue;
        }
        if (n.includes("condicion de pago")) {
          mode = "condicion";
          if (child.__children?.length) walkChildren(child.__children);
          continue;
        }

        if (child.type === "bulleted_list_item" || child.type === "numbered_list_item") {
          if (mode === "entregables" && t) entregables.push(t);
          if (child.__children?.length) walkChildren(child.__children);
        } else if (mode === "condicion" && t) {
          condicionPago += (condicionPago ? " " : "") + t;
        }
      }
    };

    walkChildren(block.__children ?? []);

    const fullText = collectBlockText([block]);
    const pctMatch = fullText.match(/(\d+)\s*%/);
    const moneyMatch = fullText.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
    if (!pctMatch || !moneyMatch) continue;

    pagos.push({
      fase,
      hito,
      porcentaje: parseInt(pctMatch[1], 10),
      monto: formatMoney(parseMoney(moneyMatch[0]) ?? 0),
      entregables: entregables.length > 0 ? entregables : undefined,
      condicionPago: condicionPago || undefined,
    });
  }

  if (pagos.length === 0) {
    const text = collectBlockText(s.blocks);
    const chunks = text.split(/(?=fase\s*\d+)/i).filter((c) => /fase\s*\d+/i.test(c));

    for (const chunk of chunks) {
      const faseMatch = chunk.match(/fase\s*(\d+)/i);
      const pctMatch = chunk.match(/(\d+)\s*%/);
      const moneyMatch = chunk.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
      const hitoMatch = chunk.match(/fase\s*\d+\s*[-–]\s*([^\n]+)/i);
      if (!faseMatch || !pctMatch || !moneyMatch) continue;

      const entregables: string[] = [];
      const entBlock = chunk.match(/entregables asociados:?\s*([\s\S]*?)(?:condici[oó]n de pago|$)/i);
      if (entBlock) {
        for (const line of entBlock[1].split("\n")) {
          const item = line.replace(/^[-*•]\s*/, "").trim();
          if (item) entregables.push(item);
        }
      }
      const condMatch = chunk.match(/condici[oó]n de pago:?\s*([\s\S]*?)(?=fase\s*\d+|$)/i);

      pagos.push({
        fase: parseInt(faseMatch[1], 10),
        hito: (hitoMatch?.[1] ?? "Hito de pago").trim(),
        porcentaje: parseInt(pctMatch[1], 10),
        monto: formatMoney(parseMoney(moneyMatch[0]) ?? 0),
        entregables: entregables.length > 0 ? entregables : undefined,
        condicionPago: condMatch?.[1]?.trim() || undefined,
      });
    }
  }

  return pagos.sort((a, b) => a.fase - b.fase);
}

function hasNotionFinancials(fin: Partial<CorporateFinancials>): boolean {
  return (
    (fin.subtotal ?? 0) > 0 ||
    (fin.total ?? 0) > 0 ||
    (fin.precioDesarrollo ?? 0) > 0 ||
    (fin.totalHoras ?? 0) > 0
  );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseProposalFromBlocks(
  blocks: PropuestaBlock[],
  cover: CorporateCover,
): CorporateProposalContent {
  const sections = splitIntoSections(blocks);
  const financialsFromNotion = parseFinancials(sections, blocks);
  const pagosFromNotion = parsePagos(sections);
  const sectionHtmls = parseSectionHtmls(sections);

  return {
    cover,
    scrumMaster: findRoleInTables(sections, blocks, "scrum"),
    qaResponsable: findRoleInTables(sections, blocks, "qa", "calidad"),
    objetivos: parseObjetivos(sections),
    modulos: parseModulos(sections),
    personal: parsePersonal(sections),
    actividades: parseActividades(sections),
    requerimientos: parseRequerimientos(sections),
    financialsFromNotion: hasNotionFinancials(financialsFromNotion) ? financialsFromNotion : undefined,
    pagosFromNotion: pagosFromNotion.length > 0 ? pagosFromNotion : undefined,
    ...sectionHtmls,
  };
}

/** Secciones ya cubiertas por las páginas fijas de metodología (portada → p.6). */
const SKIP_DYNAMIC_HEADINGS = new Set([
  "metadatos de la propuesta",
  "manticore labs",
  "indice",
  "indice de contenidos",
  "objetivos",
  "objetivo",
  "descripcion y metodologia",
  "metodologia",
  "responsabilidad del proveedor",
  "responsabilidad del cliente",
]);

function stripLeadingSectionNumber(heading: string): string {
  return normalize(heading).replace(/^\d+[\.\)]\s*/, "").trim();
}

function isSkipDynamicHeading(heading: string): boolean {
  const n = stripLeadingSectionNumber(heading);
  if (!n) return false;
  if (/^propuesta\b/.test(n)) return true;
  return SKIP_DYNAMIC_HEADINGS.has(n);
}

/** Bloques de Notion para las páginas variables (desde Descripción de la solución). */
export function filterDynamicContentBlocks(blocks: PropuestaBlock[]): PropuestaBlock[] {
  const sections = splitIntoSections(blocks);
  const out: PropuestaBlock[] = [];

  for (const s of sections) {
    if (isSkipDynamicHeading(s.heading)) continue;
    if (s.heading) {
      out.push({
        type: "heading_2",
        heading_2: { rich_text: [{ plain_text: s.heading }] },
      });
    }
    out.push(...s.blocks);
  }

  return out;
}

function splitBlocksBySection(blocks: PropuestaBlock[]): PropuestaBlock[][] {
  const groups: PropuestaBlock[][] = [];
  let current: PropuestaBlock[] = [];

  for (const block of blocks) {
    if (block.type === "heading_1" || block.type === "heading_2") {
      if (current.length > 0) groups.push(current);
      current = [block];
    } else {
      current.push(block);
    }
  }
  if (current.length > 0) groups.push(current);

  return groups;
}

/** Agrupa bloques por sección para paginar con pie de página corporativo. */
export function splitBlocksForPdfPages(blocks: PropuestaBlock[]): PropuestaBlock[][] {
  return splitBlocksBySection(filterDynamicContentBlocks(blocks));
}
