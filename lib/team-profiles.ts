import type { TeamClient, TeamClientProjectOption, TeamEnvironment, TeamScope } from "./team-types";

/** Proyectos frecuentes (fallback si no hay NOTION_PROJECTS_DATABASE_ID). */
export const TEAM_PROJECT_OPTIONS = [
  { relationId: "32f4f339-cf21-803b-4a2c-29196fe31f6", label: "Manticore Labs — Gestión" },
  { relationId: "32d4f339-cf21-80d7-a5a8d860913a99b1", label: "Bago — Zonales" },
  { relationId: "32f4f339-cf21-8003-b4a2-c29196fe31f6", label: "Bago — SGC" },
  { relationId: "45dac611-aded-4775-b62c-99f2f1bb945d", label: "Bago — MM360" },
];

/** Valores de Proyecto Cliente (fallback si falla el esquema de Notion). */
export const TEAM_CLIENT_PROJECT_OPTIONS: TeamClientProjectOption[] = [
  { value: "[ML][Gestion]", label: "ML — Gestión" },
  { value: "[ML][SIB-BAGO]", label: "ML — SIB Bago" },
  { value: "[BAGO][SICAB-MG]", label: "Bago — SGC / SICAB" },
  { value: "[BAGO][ZONALES-MG]", label: "Bago — Zonales" },
  { value: "[BAGO][REGA-MG]", label: "Bago — REGA" },
  { value: "[BAGO][SICAB]", label: "Bago — SICAB (legacy)" },
  { value: "[BAGO][REGA]", label: "Bago — REGA (legacy)" },
  { value: "[Bago][Zonales]", label: "Bago — Zonales (legacy)" },
  { value: "[Bago][CRM]", label: "Bago — CRM" },
  { value: "[Bago][MM360]", label: "Bago — MM360" },
  { value: "[Bago][LOPD]", label: "Bago — LOPD" },
  { value: "[Bago][CC]", label: "Bago — CC" },
  { value: "[Bago][LAMBDA]", label: "Bago — Lambda" },
  { value: "[Bago][AsoService]", label: "Bago — AsoService" },
  { value: "[Bago][GIP]", label: "Bago — GIP" },
  { value: "[Bago][SID]", label: "Bago — SID" },
  { value: "[BAGO][CARGA-VENTAS-MG]", label: "Bago — Carga Ventas" },
  { value: "[BAGO][CONGRESOS-MG]", label: "Bago — Congresos" },
  { value: "[BAGO][MEDGO]", label: "Bago — MedGo" },
  { value: "[BAGO][CRONJOB]", label: "Bago — CronJob" },
  { value: "[BAGO][CONTRATOS]", label: "Bago — Contratos" },
  { value: "[BAGO][LIQUIDACIÓN-PROMOCIONES]", label: "Bago — Liquidación Promociones" },
  { value: "[BAGO][HERRAMIENTA-SOSTENIBILIDAD]", label: "Bago — Herramienta Sostenibilidad" },
  { value: "[Plast][Herramienta]", label: "Plasticaucho — Herramienta" },
];

export const TEAM_CATEGORY_OPTIONS = [
  "Workflows",
  "Frontend",
  "Backend",
  "BUG",
  "Requerimientos",
  "devops",
  "UI",
  "Test",
  "Process Management",
  "Onboarding",
] as const;

export type TeamCategory = (typeof TEAM_CATEGORY_OPTIONS)[number];

export const TEAM_TAG_SUGGESTIONS = [
  "tareas",
  "bugs",
  "qa",
  "DEV",
  "despliegue",
  "Frontend",
  "Backend",
  "notion",
  "cursor",
  "proyectos",
  "zonales",
  "sgc",
  "requerimientos",
  "DevOps",
] as const;

export const DEFAULT_TEAM_CLIENT: TeamClient = "Manticore Labs";
export const DEFAULT_TEAM_CLIENT_PROJECT = "[ML][Gestion]";
export const DEFAULT_TEAM_PROJECT =
  TEAM_PROJECT_OPTIONS[0]?.relationId ?? "32f4f339-cf21-803b-4a2c-29196fe31f6";

const CLIENT_PROJECT_TO_TAG: Record<string, string> = {
  "[BAGO][SICAB-MG]": "sgc",
  "[BAGO][SICAB]": "sgc",
  "[BAGO][ZONALES-MG]": "zonales",
  "[Bago][Zonales]": "zonales",
  "[BAGO][REGA-MG]": "rega",
  "[BAGO][REGA]": "rega",
};

export function scopeToCategories(scope: TeamScope): string[] {
  if (scope === "Frontend") return ["Frontend"];
  if (scope === "Backend") return ["Backend"];
  return ["Frontend", "Backend"];
}

export function environmentToTag(env: TeamEnvironment): string {
  if (env === "Desarrollo") return "DEV";
  if (env === "QA") return "qa";
  return "despliegue";
}

export function inferClientFromClientProject(clientProject: string): TeamClient {
  const upper = clientProject.toUpperCase();
  if (upper.includes("PLAST")) return "Plasticaucho";
  if (upper.includes("BAGO")) return "Bago";
  return "Manticore Labs";
}

export function resolveTeamClientProject(
  raw: string | null | undefined,
  options: TeamClientProjectOption[] = TEAM_CLIENT_PROJECT_OPTIONS
): string {
  const value = (raw ?? "").trim();
  if (!value) return DEFAULT_TEAM_CLIENT_PROJECT;

  const exact = options.find((o) => o.value === value);
  if (exact) return exact.value;

  const lower = value.toLowerCase();
  const byLabel = options.find((o) => o.label.toLowerCase() === lower);
  if (byLabel) return byLabel.value;

  if (lower === "gestion" || lower === "ml") return "[ML][Gestion]";
  if (lower === "sgc" || lower === "sicab") return "[BAGO][SICAB-MG]";
  if (lower === "zonales") return "[BAGO][ZONALES-MG]";

  return value;
}

export function resolveTeamProject(
  raw: string | null | undefined,
  options: Array<{ relationId: string; label: string }> = TEAM_PROJECT_OPTIONS
): string {
  const value = (raw ?? "").trim();
  if (!value) return options[0]?.relationId ?? DEFAULT_TEAM_PROJECT;

  const exact = options.find((o) => o.relationId === value);
  if (exact) return exact.relationId;

  const lower = value.toLowerCase();
  const byLabel = options.find((o) => o.label.toLowerCase() === lower);
  if (byLabel) return byLabel.relationId;

  return options[0]?.relationId ?? DEFAULT_TEAM_PROJECT;
}

/** Etiquetas sugeridas según tipo de ticket, proyecto y ambiente. */
export function getDefaultTeamTags(
  ticketType: string,
  clientProject: string,
  extraTags: string[],
  environment?: TeamEnvironment
): string[] {
  const tags = new Set<string>(["tareas", ...extraTags.filter(Boolean)]);

  if (ticketType === "Bug") {
    tags.add("bugs");
  }

  if (environment) {
    tags.add(environmentToTag(environment));
  }

  const projectTag = CLIENT_PROJECT_TO_TAG[clientProject];
  if (projectTag) tags.add(projectTag);

  return [...tags];
}

/** Prefija ambiente y área al cuerpo markdown si aún no están. */
export function buildTeamBodyMarkdown(bodyMarkdown: string, environment: TeamEnvironment, scope: TeamScope): string {
  const base = bodyMarkdown.trim();
  if (base.includes("## Ambiente") || base.includes("## Área")) return base;

  const header = `## Ambiente\n${environment}\n\n## Área\n${scope}\n\n`;
  return base ? header + base : header.trimEnd();
}
