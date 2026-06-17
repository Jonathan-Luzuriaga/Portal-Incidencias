import { getNotionClient } from "./notion-client";
import { ServiceError } from "./types";

interface SprintRow {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
  status: string | null;
}

let cachedSprintId: { id: string; expiresAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

function readSprintRow(page: {
  id: string;
  properties: Record<string, { type: string; title?: Array<{ plain_text: string }>; date?: { start?: string; end?: string } | null; status?: { name?: string } | null }>;
}): SprintRow {
  const titleProp = Object.values(page.properties).find((p) => p.type === "title");
  return {
    id: page.id,
    name: titleProp?.title?.[0]?.plain_text ?? "",
    start: page.properties.Fechas?.date?.start ?? null,
    end: page.properties.Fechas?.date?.end ?? null,
    status: page.properties["Estado del sprint"]?.status?.name ?? null,
  };
}

function pickCurrentSprint(rows: SprintRow[], today: string): SprintRow | null {
  const byStatus = rows.find((r) => r.status === "Actual");
  if (byStatus) return byStatus;

  const inRange = rows.find((r) => {
    if (!r.start) return false;
    const end = r.end ?? r.start;
    return r.start <= today && today <= end;
  });
  if (inRange) return inRange;

  const past = rows
    .filter((r) => r.start && r.start <= today)
    .sort((a, b) => (b.start ?? "").localeCompare(a.start ?? ""));
  return past[0] ?? rows[rows.length - 1] ?? null;
}

/** Resuelve el sprint vigente: status "Actual" → rango de fechas → fallback env. */
export async function resolveCurrentSprintId(): Promise<string | null> {
  const fromEnv = process.env.NOTION_SPRINT_RELATION_ID?.trim();
  if (fromEnv) return fromEnv;

  if (cachedSprintId && cachedSprintId.expiresAt > Date.now()) {
    return cachedSprintId.id;
  }

  const sprintDbId = process.env.NOTION_SPRINT_DATABASE_ID;
  if (!sprintDbId) return null;

  const notion = getNotionClient();

  try {
    const db = await notion.request<{ data_sources: Array<{ id: string }> }>({
      path: `databases/${sprintDbId}`,
      method: "get",
    });
    const dsId = db.data_sources?.[0]?.id;
    if (!dsId) return null;

    const query = await notion.request<{ results: Parameters<typeof readSprintRow>[0][] }>({
      path: `data_sources/${dsId}/query`,
      method: "post",
      body: { page_size: 50 },
    });

    const rows = query.results.map(readSprintRow);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
    const current = pickCurrentSprint(rows, today);

    if (!current) return null;

    cachedSprintId = { id: current.id, expiresAt: Date.now() + CACHE_MS };
    return current.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.warn("[notion-sprint] No se pudo resolver sprint actual:", msg);
    return null;
  }
}

export async function requireCurrentSprintId(): Promise<string> {
  const id = await resolveCurrentSprintId();
  if (!id) {
    throw new ServiceError(
      "No se pudo determinar el sprint actual. Configura NOTION_SPRINT_RELATION_ID o NOTION_SPRINT_DATABASE_ID.",
      502
    );
  }
  return id;
}
