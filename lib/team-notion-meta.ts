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

  const notion = getNotionClient();
  const titleProp = process.env.NOTION_PROJECTS_TITLE_PROP ?? "Project name";

  try {
    const dsId = await getDataSourceId(databaseId, "projects");

    const response = await notion.request<{
      results: Array<{ id: string; properties: Record<string, unknown> }>;
    }>({
      path: `data_sources/${dsId}/query`,
      method: "post",
      body: {
        sorts: [{ property: titleProp, direction: "ascending" }],
        page_size: 100,
      },
    });

    const projects: TeamProjectOption[] = [];
    for (const page of response.results) {
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

/** Opciones de Proyecto Cliente desde el esquema de la BD Tareas. */
export async function listClientProjectOptions(): Promise<TeamClientProjectOption[]> {
  const notion = getNotionClient();
  const config = getNotionConfig();
  const propName = config.props.clientProject;

  try {
    const db = await notion.request<{
      properties?: Record<
        string,
        { type?: string; multi_select?: { options?: Array<{ name: string }> } }
      >;
      data_sources?: Array<{
        properties?: Record<
          string,
          { type?: string; multi_select?: { options?: Array<{ name: string }> } }
        >;
      }>;
    }>({
      path: `databases/${config.databaseId}`,
      method: "get",
    });

    const properties = db.properties ?? db.data_sources?.[0]?.properties ?? {};
    const prop = properties[propName];
    const options = prop?.multi_select?.options ?? [];

    return options
      .map((o) => o.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((value) => ({ value, label: value }));
  } catch {
    const { TEAM_CLIENT_PROJECT_OPTIONS } = await import("./team-profiles");
    return TEAM_CLIENT_PROJECT_OPTIONS;
  }
}

async function listUsersFromWorkspace(): Promise<TeamUserOption[]> {
  const notion = getNotionClient();
  const users: TeamUserOption[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.users.list({
      start_cursor: cursor,
      page_size: 100,
    });

    for (const u of response.results) {
      if (u.type === "person" && u.name) {
        users.push({
          id: u.id,
          name: u.name,
          avatarUrl: u.avatar_url ?? null,
        });
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return users;
}

/** Responsables usados recientemente en tareas (fallback si users.list viene vacío). */
async function listAssigneesFromTasks(): Promise<TeamUserOption[]> {
  const notion = getNotionClient();
  const config = getNotionConfig();
  const teamProps = getTeamNotionProps();
  const dsId = await getDataSourceId(config.databaseId, "tasks");

  const response = await notion.request<{
    results: Array<{
      properties: Record<
        string,
        { type?: string; people?: Array<{ id: string; name?: string | null }> }
      >;
    }>;
  }>({
    path: `data_sources/${dsId}/query`,
    method: "post",
    body: {
      filter: {
        property: teamProps.assignee,
        people: { is_not_empty: true },
      },
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      page_size: 50,
    },
  });

  const byId = new Map<string, TeamUserOption>();
  for (const page of response.results) {
    const people = page.properties[teamProps.assignee]?.people ?? [];
    for (const person of people) {
      if (!person.id || byId.has(person.id)) continue;
      byId.set(person.id, {
        id: person.id,
        name: person.name ?? "Usuario",
        avatarUrl: null,
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Usuarios del workspace + responsables recientes en tareas. */
export async function listTeamUsers(): Promise<TeamUserOption[]> {
  try {
    const [workspace, fromTasks] = await Promise.all([
      listUsersFromWorkspace().catch(() => [] as TeamUserOption[]),
      listAssigneesFromTasks().catch(() => [] as TeamUserOption[]),
    ]);

    const byId = new Map<string, TeamUserOption>();
    for (const u of [...workspace, ...fromTasks]) {
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

/** Épicas y tareas del proyecto para usar como padre. */
export async function listParentTasks(projectRelationId: string): Promise<TeamParentOption[]> {
  if (!projectRelationId) return [];

  const notion = getNotionClient();
  const config = getNotionConfig();
  const { props } = config;

  try {
    const dsId = await getDataSourceId(config.databaseId, "tasks");

    const response = await notion.request<{
      results: Array<{ id: string; properties: Record<string, unknown> }>;
    }>({
      path: `data_sources/${dsId}/query`,
      method: "post",
      body: {
        filter: {
          and: [
            {
              property: props.project,
              relation: { contains: projectRelationId },
            },
            {
              or: [
                { property: props.ticketType, select: { equals: "Épica" } },
                { property: props.ticketType, select: { equals: "Tarea" } },
              ],
            },
          ],
        },
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
        page_size: 40,
      },
    });

    return response.results.map((page) => ({
      id: page.id,
      title: extractPageTitle(page, props.title),
      ticketType: extractSelect(page, props.ticketType),
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    throw new ServiceError(`No se pudieron listar tareas padre. ${message}`, 502);
  }
}
