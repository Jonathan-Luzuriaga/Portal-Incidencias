/** Ángeles Correa, Cinthia Burbano — responsables por defecto en propuestas e incidencias Bago. */
export const DEFAULT_PM_ASSIGNEE_IDS = [
  "334d872b-594c-81ab-8fd2-00025b930cba",
  "335d872b-594c-8136-83a5-00021ea2cf93",
] as const;

export function defaultPmAssigneeIdsCsv(): string {
  return DEFAULT_PM_ASSIGNEE_IDS.join(",");
}
