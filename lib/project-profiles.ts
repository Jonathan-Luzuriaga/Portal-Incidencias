export interface ClientProjectOption {
  /** Valor exacto de la columna Proyecto Cliente en Notion. */
  value: string;
  /** Texto visible en el formulario. */
  label: string;
  /** Contexto para DeepSeek en el cuerpo del reporte. */
  projectContext: string;
}

/** Proyectos Bago disponibles en Proyecto Cliente (Notion). */
export const BAGO_CLIENT_PROJECT_OPTIONS: ClientProjectOption[] = [
  { value: "[BAGO][SICAB-MG]", label: "SGC / SICAB", projectContext: "SGC Front" },
  { value: "[BAGO][ZONALES-MG]", label: "Zonales", projectContext: "Zonales Front" },
  { value: "[BAGO][REGA-MG]", label: "REGA", projectContext: "REGA" },
  { value: "[BAGO][SICAB]", label: "SICAB", projectContext: "SICAB" },
  { value: "[BAGO][REGA]", label: "REGA (legacy)", projectContext: "REGA" },
  { value: "[Bago][Zonales]", label: "Zonales (legacy)", projectContext: "Zonales Front" },
  { value: "[Bago][CRM]", label: "CRM", projectContext: "CRM Bago" },
  { value: "[Bago][MM360]", label: "MM360", projectContext: "MM360" },
  { value: "[Bago][LOPD]", label: "LOPD", projectContext: "LOPD" },
  { value: "[Bago][CC]", label: "CC", projectContext: "CC Bago" },
  { value: "[Bago][LAMBDA]", label: "Lambda", projectContext: "Lambda Bago" },
  { value: "[Bago][AsoService]", label: "AsoService", projectContext: "AsoService" },
  { value: "[Bago][GIP]", label: "GIP", projectContext: "GIP" },
  { value: "[Bago][SID]", label: "SID", projectContext: "SID" },
  { value: "[BAGO][CARGA-VENTAS-MG]", label: "Carga Ventas", projectContext: "Carga Ventas" },
  { value: "[BAGO][CONGRESOS-MG]", label: "Congresos", projectContext: "Congresos" },
  { value: "[BAGO][MEDGO]", label: "MedGo", projectContext: "MedGo" },
  { value: "[BAGO][CRONJOB]", label: "CronJob", projectContext: "CronJob" },
  { value: "[BAGO][CONTRATOS]", label: "Contratos", projectContext: "Contratos" },
  { value: "[BAGO][LIQUIDACIÓN-PROMOCIONES]", label: "Liquidación Promociones", projectContext: "Liquidación Promociones" },
  { value: "[BAGO][HERRAMIENTA-SOSTENIBILIDAD]", label: "Herramienta Sostenibilidad", projectContext: "Herramienta Sostenibilidad" },
];

export const DEFAULT_CLIENT_PROJECT = "[BAGO][ZONALES-MG]";

/** Etiquetas base para incidencias QA de Bago. */
const BAGO_BASE_TAGS = ["tareas", "bugs", "qa", "Frontend", "UX/UI"] as const;

/**
 * Mapeo Proyecto Cliente → etiqueta en columna Etiquetas (solo Bago).
 * Debe coincidir con opciones existentes en Notion.
 */
export const BAGO_CLIENT_PROJECT_TO_TAG: Record<string, string> = {
  "[BAGO][SICAB-MG]": "sgc",
  "[BAGO][SICAB]": "sgc",
  "[BAGO][ZONALES-MG]": "zonales",
  "[Bago][Zonales]": "zonales",
  "[BAGO][REGA-MG]": "rega",
  "[BAGO][REGA]": "rega",
  "[BAGO][CARGA-VENTAS-MG]": "carga-ventas",
  "[BAGO][CONGRESOS-MG]": "congresos",
  "[BAGO][MEDGO]": "medgo",
  "[BAGO][CRONJOB]": "cronjob",
  "[BAGO][CONTRATOS]": "contratos",
  "[BAGO][LIQUIDACIÓN-PROMOCIONES]": "liquidacion",
  "[BAGO][HERRAMIENTA-SOSTENIBILIDAD]": "sostenibilidad",
};

/** Etiquetas de Notion derivadas de Proyecto Cliente (solo Bago). */
export function getNotionTags(clientProject: string): string[] {
  const projectTag = BAGO_CLIENT_PROJECT_TO_TAG[clientProject];
  if (projectTag) {
    return [...BAGO_BASE_TAGS, projectTag];
  }

  const match = clientProject.match(/\[[^\]]+\]\[([^\]]+)\]/i);
  if (match) {
    const slug = match[1].toLowerCase().replace(/-mg$/i, "");
    return [...BAGO_BASE_TAGS, slug];
  }

  return [...BAGO_BASE_TAGS];
}

export function getProjectContext(clientProject: string): string {
  const option = BAGO_CLIENT_PROJECT_OPTIONS.find((o) => o.value === clientProject);
  return option?.projectContext ?? "Bago";
}

export function resolveClientProject(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return DEFAULT_CLIENT_PROJECT;

  const exact = BAGO_CLIENT_PROJECT_OPTIONS.find((o) => o.value === value);
  if (exact) return exact.value;

  const lower = value.toLowerCase();
  const byLabel = BAGO_CLIENT_PROJECT_OPTIONS.find((o) => o.label.toLowerCase() === lower);
  if (byLabel) return byLabel.value;

  // Compatibilidad con ?proyecto=sgc|zonales
  if (lower === "sgc" || lower === "sgc-front" || lower === "sgc front") {
    return "[BAGO][SICAB-MG]";
  }
  if (lower === "zonales" || lower === "zonales-front" || lower === "zonales front") {
    return "[BAGO][ZONALES-MG]";
  }

  return DEFAULT_CLIENT_PROJECT;
}

export function inferClientProjectFromText(text: string, fallback: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("zonales") || lower.includes("zonal")) return "[BAGO][ZONALES-MG]";
  if (lower.includes("sgc") || lower.includes("sicab")) return "[BAGO][SICAB-MG]";
  if (lower.includes("rega")) return "[BAGO][REGA-MG]";
  return fallback;
}
