import {
  isCanonicalProjectLabel,
  normalizeTeamLabel,
  TEAM_PROJECT_NAMES,
} from "./team-profiles";
import type { TeamProjectOption } from "./team-types";
import { ServiceError } from "./types";

/** UUID de página Notion (con o sin guiones). */
export function isNotionPageId(value: string): boolean {
  const compact = value.trim().replace(/-/g, "");
  return /^[0-9a-f]{32}$/i.test(compact);
}

function readEnvId(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value && isNotionPageId(value)) return value;
  }
  return null;
}

/** Mapa nombre de proyecto → page id (relation). Mismo patrón que /propuestas y /bago. */
export function buildProjectRelationMap(): Map<string, string> {
  const map = new Map<string, string>();

  const bagoId = readEnvId("NOTION_PROJECT_RELATION_ID");
  if (bagoId) map.set(normalizeTeamLabel("Bago"), bagoId);

  const propuestasId = readEnvId(
    "NOTION_PROPUESTA_PROJECT_RELATION_ID",
    "NOTION_PROPUESTA_PROJECT_ID"
  );
  if (propuestasId) map.set(normalizeTeamLabel("Propuestas"), propuestasId);

  const proformasId = readEnvId(
    "NOTION_PROFORMA_PROJECT_RELATION_ID",
    "NOTION_PROFORMAS_PROJECT_RELATION_ID"
  );
  if (proformasId) map.set(normalizeTeamLabel("Proformas"), proformasId);

  const rawMap = process.env.NOTION_PROJECT_RELATION_MAP?.trim();
  if (rawMap) {
    try {
      const parsed = JSON.parse(rawMap) as Record<string, string>;
      for (const [label, id] of Object.entries(parsed)) {
        if (typeof id === "string" && isNotionPageId(id)) {
          map.set(normalizeTeamLabel(label), id.trim());
        }
      }
    } catch {
      // JSON inválido: se ignoran entradas extra
    }
  }

  return map;
}

function defaultRelationProjectId(): string {
  const bagoId = readEnvId("NOTION_PROJECT_RELATION_ID");
  if (bagoId) return bagoId;
  throw new ServiceError(
    "Falta NOTION_PROJECT_RELATION_ID (UUID del proyecto Bago en Notion).",
    500
  );
}

/**
 * Resuelve el page id para la columna relation Proyecto.
 * Acepta UUID directo o etiqueta canónica (ej. "Bago").
 */
export function resolveTeamProjectRelationId(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return defaultRelationProjectId();
  if (isNotionPageId(value)) return value;

  const map = buildProjectRelationMap();
  const byLabel = map.get(normalizeTeamLabel(value));
  if (byLabel) return byLabel;

  throw new ServiceError(
    `El proyecto "${value}" no tiene UUID de relación configurado. ` +
      `Agrega su page id en NOTION_PROJECT_RELATION_MAP o configura NOTION_PROJECTS_DATABASE_ID.`,
    400
  );
}

/** Opciones de proyecto con UUIDs reales cuando no se puede listar la BD de Proyectos. */
export function getRelationProjectOptionsFallback(): TeamProjectOption[] {
  const map = buildProjectRelationMap();
  const options: TeamProjectOption[] = [];

  for (const name of TEAM_PROJECT_NAMES) {
    const id = map.get(normalizeTeamLabel(name));
    if (id) {
      options.push({ relationId: id, label: name });
    }
  }

  if (options.length === 0) {
    try {
      options.push({ relationId: defaultRelationProjectId(), label: "Bago" });
    } catch {
      // sin env
    }
  }

  return options
    .filter((o) => isCanonicalProjectLabel(o.label))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}
