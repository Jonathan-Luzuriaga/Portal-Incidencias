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
  CorporateModule,
  CorporatePersonal,
  CorporateProposalContent,
  CorporateRequirement,
} from "./corporate-types";
import type { PropuestaBlock } from "./html";
import { ACTIVITY_ORDER } from "./calc";

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
  return extractBullets(s.blocks);
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

  const iAct = col(t.norm, "actividad", "fase", "etapa", "nombre");
  const iDesc = col(t.norm, "descripcion", "detalle");
  const iSem = col(t.norm, "semana", "tiempo", "duracion");

  if (t.rows.length === 9 && iAct < 0) {
    return t.rows.map((r) => ({
      descripcion: iDesc >= 0 ? (r[iDesc] ?? "").trim() : "",
      semanas: iSem >= 0 ? parseSemanas(r[iSem] ?? "") : 0,
    }));
  }

  const nameCol = iAct >= 0 ? iAct : 0;
  for (const r of t.rows) {
    const idx = matchActivityIndex(r[nameCol] ?? "");
    if (idx >= 0) {
      result[idx] = {
        descripcion: iDesc >= 0 ? (r[iDesc] ?? "").trim() : (r[nameCol] ?? "").trim(),
        semanas: iSem >= 0 ? parseSemanas(r[iSem] ?? "") : 0,
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

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseProposalFromBlocks(
  blocks: PropuestaBlock[],
  cover: CorporateCover,
): CorporateProposalContent {
  const sections = splitIntoSections(blocks);

  return {
    cover,
    scrumMaster: findRoleInTables(sections, blocks, "scrum"),
    qaResponsable: findRoleInTables(sections, blocks, "qa", "calidad"),
    objetivos: parseObjetivos(sections),
    modulos: parseModulos(sections),
    personal: parsePersonal(sections),
    actividades: parseActividades(sections),
    requerimientos: parseRequerimientos(sections),
  };
}

/** Secciones ya cubiertas por las páginas fijas de metodología (portada → p.6). */
const SKIP_DYNAMIC_HEADINGS = [
  "metadatos de la propuesta",
  "manticore labs",
  "indice",
  "objetivo",
  "descripcion y metodologia",
  "metodologia",
  "responsabilidad del proveedor",
  "responsabilidad del cliente",
];

function isSkipDynamicHeading(heading: string): boolean {
  const n = normalize(heading);
  if (!n) return false;
  if (/^propuesta\b/.test(n)) return true;
  return SKIP_DYNAMIC_HEADINGS.some((k) => n.includes(k));
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
