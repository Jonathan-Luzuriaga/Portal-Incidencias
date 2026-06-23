import { getNotionClient } from "./notion-client";
import { getNotionConfig } from "./notion-config";
import { getTeamNotionProps } from "./team-notion-config";
import type {
  TeamClientProjectOption,
  TeamParentOption,
  TeamProjectOption,
  TeamUserOption,
} from "./team-types";
import { ServiceError } from "./types";

let cachedTasksDataSourceId: string | null = null;
let cachedProjectsDataSourceId: string | null = null;

const PLACEHOLDER_PROJECT_TITLES = new Set([
  "nuevo proyecto",
  "new project",
  "sin título",
  "sin titulo",
  "untitled",
  "proyecto nuevo",
  "",
]);

const PARENT_TICKET_TYPES = ["Épica", "Tarea"];

async function getDataSourceId(databaseId: string, cache: "tasks" | "projects"): Promise<string> {
  if (cache === "tasks" && cachedTasksDataSourceId) return cachedTasksDataSourceId;
  if (cache === "projects" && cachedProjectsDataSourceId) return cachedProjectsDataSourceId;

  const notion = getNotionClient();
  const db = await notion.request<{ data_sources: Array<{ id: string }> }>({
    path: `databases/${databaseId}`,
    method: "get",
  });

  const dsId = db.data_sources?.[0]?.id;
  if (!dsId) {
    throw new ServiceError(`No se encontró data source para la BD ${databaseId}.`, 502);
  }

  if (cache === "tasks") cachedTasksDataSourceId = dsId;
  else cachedProjectsDataSourceId = dsId;

  return dsId;
}

async function queryDataSourceAllPages<T extends { id: string }>(
  dsId: string,
  body: Record<string, unknown>,
  maxPages = 30
): Promise<T[]> {
  const notion = getNotionClient();
  const results: T[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const response = await notion.request<{
      results: T[];
      has_more: boolean;
      next_cursor: string | null;
    }>({
      path: `data_sources/${dsId}/query`,
      method: "post",
      body: {
        ...body,
        start_cursor: cursor,
        page_size: 100,
      },
    });

    results.push(...response.results);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    pages++;
  } while (cursor && pages < maxPages);

  return results;
}

function getProjectsDatabaseId(): string | null {
  return process.env.NOTION_PROJECTS_DATABASE_ID?.trim() || null;
}

function extractPageTitle(
  page: { properties: Record<string, unknown> },
  titlePropName: string
): string {
  const titleProp = page.properties[titlePropName] as
    | { title?: Array<{ plain_text?: string }> }
    | undefined;
  return titleProp?.title?.map((t) => t.plain_text ?? "").join("").trim() ?? "";
}

function extractSelect(page: { properties: Record<string, unknown> }, propName: string): string {
  const prop = page.properties[propName] as { select?: { name?: string } | null } | undefined;
  return prop?.select?.name ?? "";
}

function isPlaceholderProjectTitle(title: string): boolean {
  return PLACEHOLDER_PROJECT_TITLES.has(title.trim().toLowerCase());
}

/** Proyectos reales desde la BD Proyectos de Notion (sin placeholders). */
export async function listNotionProjects(): Promise<TeamProjectOption[]> {
  const databaseId = getProjectsDatabaseId();
  if (!databaseId) {
    const { TEAM_PROJECT_OPTIONS } = await import("./team-profiles");
    return TEAM_PROJECT_OPTIONS;
  }

  const titleProp = process.env.NOTION_PROJECTS_TITLE_PROP ?? "Project name";

  try {
    const dsId = await getDataSourceId(databaseId, "projects");
    const pages = await queryDataSourceAllPages<{ id: string; properties: Record<string, unknown> }>(
      dsId,
      { sorts: [{ property: titleProp, direction: "ascending" }] }
    );

    const projects: TeamProjectOption[] = [];
    for (const page of pages) {
      const label = extractPageTitle(page, titleProp);
      if (!label || isPlaceholderProjectTitle(label)) continue;
      projects.push({ relationId: page.id, label });
    }

    return projects.sort((a, b) => a.label.localeCompare(b.label, "es"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    throw new ServiceError(`No se pudieron listar proyectos de Notion. ${message}`, 502);
  }
}

type SchemaProp = {
  type?: string;
  multi_select?: { options?: Array<{ name: string }> };
  select?: { options?: Array<{ name: string }> };
};

/** Opciones de Proyecto Cliente desde el esquema (data source) de la BD Tareas. */
export async function listClientProjectOptions(): Promise<TeamClientProjectOption[]> {
  const notion = getNotionClient();
  const config = getNotionConfig();
  const propName = config.props.clientProject;

  try {
    const dsId = await getDataSourceId(config.databaseId, "tasks");

    const ds = await notion.request<{ properties?: Record<string, SchemaProp> }>({
      path: `data_sources/${dsId}`,
      method: "get",
    });

    let properties = ds.properties ?? {};

    if (!properties[propName]) {
      const db = await notion.request<{
        properties?: Record<string, SchemaProp>;
        data_sources?: Array<{ properties?: Record<string, SchemaProp> }>;
      }>({
        path: `databases/${config.databaseId}`,
        method: "get",
      });
      properties = db.properties ?? db.data_sources?.[0]?.properties ?? properties;
    }

    const prop = properties[propName];
    const options = prop?.multi_select?.options ?? prop?.select?.options ?? [];

    const mapped = options
      .map((o) => o.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((value) => ({ value, label: value }));

    if (mapped.length === 0) {
      const { TEAM_CLIENT_PROJECT_OPTIONS } = await import("./team-profiles");
      return TEAM_CLIENT_PROJECT_OPTIONS;
    }

    return mapped;
  } catch {
    const { TEAM_CLIENT_PROJECT_OPTIONS } = await import("./team-profiles");
    return TEAM_CLIENT_PROJECT_OPTIONS;
  }
}

async function resolvePersonUser(
  notion: ReturnType<typeof getNotionClient>,
  id: string,
  fallbackName?: string | null
): Promise<TeamUserOption | null> {
  try {
    const u = await notion.users.retrieve({ user_id: id });
    if (u.type !== "person") return null;
    const name = u.name?.trim() || fallbackName?.trim() || "";
    if (!name) return null;
    return {
      id: u.id,
      name,
      avatarUrl: u.avatar_url ?? null,
    };
  } catch {
    const name = fallbackName?.trim();
    if (!name) return null;
    return { id, name, avatarUrl: null };
  }
}

async function listUsersFromWorkspace(): Promise<TeamUserOption[]> {
  const notion = getNotionClient();
  const byId = new Map<string, TeamUserOption>();
  let cursor: string | undefined;

  do {
    const response = await notion.users.list({
      start_cursor: cursor,
      page_size: 100,
    });

    for (const u of response.results) {
      if (u.type !== "person" || byId.has(u.id)) continue;
      const resolved = await resolvePersonUser(notion, u.id, u.name);
      if (resolved) byId.set(resolved.id, resolved);
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return [...byId.values()];
}

/** IDs extra vía NOTION_EXTRA_ASSIGNEE_IDS (usuarios que la integración no lista sola). */
async function listExtraAssignees(): Promise<TeamUserOption[]> {
  const raw = process.env.NOTION_EXTRA_ASSIGNEE_IDS?.trim();
  if (!raw) return [];

  const notion = getNotionClient();
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const users: TeamUserOption[] = [];

  for (const id of ids) {
    try {
      const u = await notion.users.retrieve({ user_id: id });
      if (u.type === "person") {
        users.push({
          id: u.id,
          name: u.name ?? "Usuario",
          avatarUrl: u.avatar_url ?? null,
        });
      }
    } catch {
      // omitir ids inválidos
    }
  }

  return users;
}

/**
 * Personas del equipo a partir de toda la actividad en tareas:
 * Responsable, creador y último editor (captura quien nunca fue asignado).
 */
async function listPeopleFromTaskPages(): Promise<TeamUserOption[]> {
  const config = getNotionConfig();
  const teamProps = getTeamNotionProps();
  const dsId = await getDataSourceId(config.databaseId, "tasks");
  const notion = getNotionClient();

  const pages = await queryDataSourceAllPages<{
    id: string;
    created_by?: { id: string; name?: string | null };
    last_edited_by?: { id: string; name?: string | null };
    properties: Record<
      string,
      { type?: string; people?: Array<{ id: string; name?: string | null }> }
    >;
  }>(dsId, {
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
  });

  const pending = new Map<string, string | null>();

  function stage(id: string | undefined, name?: string | null) {
    if (!id) return;
    const existing = pending.get(id);
    if (!existing && name?.trim()) pending.set(id, name.trim());
    else if (!pending.has(id)) pending.set(id, null);
  }

  for (const page of pages) {
    stage(page.created_by?.id, page.created_by?.name);
    stage(page.last_edited_by?.id, page.last_edited_by?.name);
    for (const person of page.properties[teamProps.assignee]?.people ?? []) {
      stage(person.id, person.name);
    }
  }

  const users: TeamUserOption[] = [];
  for (const [id, fallbackName] of pending) {
    const resolved = await resolvePersonUser(notion, id, fallbackName);
    if (resolved) users.push(resolved);
  }

  return users.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Usuarios del workspace + responsables en tareas + extras configurados. */
export async function listTeamUsers(): Promise<TeamUserOption[]> {
  try {
    const [workspace, fromTasks, extra] = await Promise.all([
      listUsersFromWorkspace().catch(() => [] as TeamUserOption[]),
      listPeopleFromTaskPages().catch(() => [] as TeamUserOption[]),
      listExtraAssignees().catch(() => [] as TeamUserOption[]),
    ]);

    const byId = new Map<string, TeamUserOption>();
    for (const u of [...workspace, ...fromTasks, ...extra]) {
      if (!byId.has(u.id)) byId.set(u.id, u);
    }

    const merged = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (merged.length === 0) {
      throw new ServiceError(
        "No se encontraron usuarios. Verifica que la integración Notion tenga acceso a usuarios del workspace.",
        502
      );
    }

    return merged;
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    const message = err instanceof Error ? err.message : "Error desconocido.";
    throw new ServiceError(`No se pudieron listar responsables. ${message}`, 502);
  }
}

/**
 * Épicas y tareas candidatas a padre.
 * Proyecto y Proyecto Cliente son independientes en Notion: no se filtra por proyecto.
 */
export async function listParentTasks(): Promise<TeamParentOption[]> {
  const config = getNotionConfig();
  const { props } = config;

  try {
    const dsId = await getDataSourceId(config.databaseId, "tasks");

    const pages = await queryDataSourceAllPages<{ id: string; properties: Record<string, unknown> }>(
      dsId,
      {
        filter: {
          or: PARENT_TICKET_TYPES.map((type) => ({
            property: props.ticketType,
            select: { equals: type },
          })),
        },
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      }
    );

    const byId = new Map<string, TeamParentOption>();
    for (const page of pages) {
      const title = extractPageTitle(page, props.title);
      if (!title) continue;
      byId.set(page.id, {
        id: page.id,
        title,
        ticketType: extractSelect(page, props.ticketType),
      });
    }

    return [...byId.values()];
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    throw new ServiceError(`No se pudieron listar tareas padre. ${message}`, 502);
  }
}
