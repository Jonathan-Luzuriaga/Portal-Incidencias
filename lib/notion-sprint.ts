import { getNotionClient } from "./notion-client";
import { ServiceError } from "./types";

interface SprintRow {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
  status: string | null;
}

interface NotionSprintPage {
  id: string;
  properties: Record<
    string,
    {
      type: string;
      title?: Array<{ plain_text: string }>;
      date?: { start?: string; end?: string } | null;
      status?: { name?: string } | null;
      select?: { name?: string } | null;
    }
  >;
}

let cachedSprintId: { id: string; expiresAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

function sprintStatusPropName(): string {
  return process.env.NOTION_SPRINT_STATUS_PROP?.trim() || "Estado del sprint";
}

function sprintDatesPropName(): string {
  return process.env.NOTION_SPRINT_DATES_PROP?.trim() || "Fechas";
}

function readSprintRow(page: NotionSprintPage): SprintRow {
  const titleProp = Object.values(page.properties).find((p) => p.type === "title");
  const statusProp = page.properties[sprintStatusPropName()];
  const datesProp = page.properties[sprintDatesPropName()];
  const status =
    statusProp?.status?.name ??
    statusProp?.select?.name ??
    null;

  return {
    id: page.id,
    name: titleProp?.title?.map((t) => t.plain_text).join("").trim() ?? "",
    start: datesProp?.date?.start ?? null,
    end: datesProp?.date?.end ?? null,
    status,
  };
}

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Preferido: status "Actual" / "Current". Luego rango de fechas. Luego más reciente en el pasado. */
export function pickCurrentSprint(rows: SprintRow[], today: string): SprintRow | null {
  if (rows.length === 0) return null;

  const actual = rows.find((r) => {
    const s = normalizeStatus(r.status);
    return s === "actual" || s === "current" || s === "activo" || s === "en curso";
  });
  if (actual) return actual;

  const inRange = rows.find((r) => {
    if (!r.start) return false;
    const end = r.end ?? r.start;
    return r.start <= today && today <= end;
  });
  if (inRange) return inRange;

  const past = rows
    .filter((r) => r.start && r.start <= today)
    .sort((a, b) => (b.start ?? "").localeCompare(a.start ?? ""));
  return past[0] ?? null;
}

async function querySprintPages(
  dsId: string,
  body: Record<string, unknown>,
  maxPages = 20
): Promise<NotionSprintPage[]> {
  const notion = getNotionClient();
  const results: NotionSprintPage[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const response = await notion.request<{
      results: NotionSprintPage[];
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

async function resolveSprintFromDatabase(sprintDbId: string): Promise<string | null> {
  const notion = getNotionClient();
  const statusProp = sprintStatusPropName();

  const db = await notion.request<{ data_sources: Array<{ id: string }> }>({
    path: `databases/${sprintDbId}`,
    method: "get",
  });
  const dsId = db.data_sources?.[0]?.id;
  if (!dsId) return null;

  // 1) Intento directo: filtrar por status Actual / Current / Activo
  // Se prueba status y select por separado: un OR mixto falla si el tipo no coincide.
  const statusValues = ["Actual", "Current", "Activo", "En curso"];
  const filterKinds = ["status", "select"] as const;
  for (const kind of filterKinds) {
    for (const equals of statusValues) {
      try {
        const filtered = await querySprintPages(dsId, {
          filter: {
            property: statusProp,
            [kind]: { equals },
          },
          page_size: 10,
        });
        if (filtered.length > 0) {
          const row = readSprintRow(filtered[0]);
          console.info(
            `[notion-sprint] Sprint activo por ${kind} "${equals}": ${row.name || row.id}`
          );
          return row.id;
        }
      } catch {
        // Tipo incompatible o valor inexistente; seguir buscando.
      }
    }
  }

  // 2) Fallback: listar todos y elegir por status / fechas
  const pages = await querySprintPages(dsId, {});
  const rows = pages.map(readSprintRow);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
  const current = pickCurrentSprint(rows, today);

  if (!current) {
    console.warn(
      `[notion-sprint] No se encontró sprint vigente entre ${rows.length} filas (hoy=${today}).`
    );
    return null;
  }

  console.info(
    `[notion-sprint] Sprint resuelto: ${current.name || current.id}` +
      ` (status=${current.status ?? "n/a"}, start=${current.start ?? "n/a"})`
  );
  return current.id;
}

/**
 * Resuelve el sprint vigente.
 * Prioridad: BD Notion (status Actual → rango de fechas) → NOTION_SPRINT_RELATION_ID.
 * El id fijo de env solo se usa como último recurso, para no asignar un sprint viejo.
 */
export async function resolveCurrentSprintId(): Promise<string | null> {
  if (cachedSprintId && cachedSprintId.expiresAt > Date.now()) {
    return cachedSprintId.id;
  }

  const sprintDbId = process.env.NOTION_SPRINT_DATABASE_ID?.trim();
  if (sprintDbId) {
    try {
      const fromDb = await resolveSprintFromDatabase(sprintDbId);
      if (fromDb) {
        cachedSprintId = { id: fromDb, expiresAt: Date.now() + CACHE_MS };
        return fromDb;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.warn("[notion-sprint] No se pudo resolver sprint desde la BD:", msg);
    }
  }

  const fromEnv = process.env.NOTION_SPRINT_RELATION_ID?.trim();
  if (fromEnv) {
    console.warn(
      "[notion-sprint] Usando NOTION_SPRINT_RELATION_ID como fallback. " +
        "Si el sprint asignado es incorrecto, elimina esa variable o actualízala al sprint Actual."
    );
    cachedSprintId = { id: fromEnv, expiresAt: Date.now() + CACHE_MS };
    return fromEnv;
  }

  return null;
}

export async function requireCurrentSprintId(): Promise<string> {
  const id = await resolveCurrentSprintId();
  if (!id) {
    throw new ServiceError(
      "No se pudo determinar el sprint actual. Configura NOTION_SPRINT_DATABASE_ID " +
        "(recomendado) o NOTION_SPRINT_RELATION_ID como fallback.",
      502
    );
  }
  return id;
}
