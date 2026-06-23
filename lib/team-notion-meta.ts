import { getNotionClient } from "./notion-client";
import { getNotionConfig } from "./notion-config";
import type { TeamParentOption, TeamUserOption } from "./team-types";
import { ServiceError } from "./types";

let cachedTasksDataSourceId: string | null = null;

async function getTasksDataSourceId(): Promise<string> {
  if (cachedTasksDataSourceId) return cachedTasksDataSourceId;

  const notion = getNotionClient();
  const config = getNotionConfig();

  const db = await notion.request<{ data_sources: Array<{ id: string }> }>({
    path: `databases/${config.databaseId}`,
    method: "get",
  });

  const dsId = db.data_sources?.[0]?.id;
  if (!dsId) {
    throw new ServiceError("No se encontró data source de la BD Tareas.", 502);
  }

  cachedTasksDataSourceId = dsId;
  return dsId;
}

function extractTitle(page: { properties: Record<string, unknown> }): string {
  const props = getNotionConfig().props;
  const titleProp = page.properties[props.title] as
    | { title?: Array<{ plain_text?: string }> }
    | undefined;
  const chunks = titleProp?.title?.map((t) => t.plain_text ?? "").join("") ?? "";
  return chunks.trim() || "Sin título";
}

function extractSelect(page: { properties: Record<string, unknown> }, propName: string): string {
  const prop = page.properties[propName] as { select?: { name?: string } | null } | undefined;
  return prop?.select?.name ?? "";
}

/** Usuarios person del workspace Notion (para Responsable). */
export async function listTeamUsers(): Promise<TeamUserOption[]> {
  const notion = getNotionClient();

  try {
    const response = await notion.users.list({});
    return response.results
      .filter((u) => u.type === "person" && u.name)
      .map((u) => ({
        id: u.id,
        name: u.name ?? "Usuario",
        avatarUrl: u.avatar_url ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    throw new ServiceError(`No se pudieron listar usuarios de Notion. ${message}`, 502);
  }
}

/** Épicas y tareas del proyecto para usar como padre. */
export async function listParentTasks(projectRelationId: string): Promise<TeamParentOption[]> {
  const notion = getNotionClient();
  const config = getNotionConfig();
  const { props } = config;

  try {
    const dsId = await getTasksDataSourceId();

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
      title: extractTitle(page),
      ticketType: extractSelect(page, props.ticketType),
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    throw new ServiceError(`No se pudieron listar tareas padre. ${message}`, 502);
  }
}
