import { getNotionClient } from "./notion-client";
import { getNotionConfig } from "./notion-config";
import { getTeamNotionProps } from "./team-notion-config";
import { resolveCurrentSprintId } from "./notion-sprint";
import {
  notionPeople,
  notionRelation,
  notionRichText,
  notionSelect,
  notionTitle,
} from "./notion-properties";
import { ServiceError } from "./types";
import type {
  CreateJornadaInput,
  JornadaEntry,
  JornadaTaskOption,
  JornadaTotals,
  UpdateJornadaInput,
} from "./jornada-types";

/** BD "Registro de Jornada Diaria" (override por env, fallback al id conocido). */
const DEFAULT_JORNADA_DATABASE_ID = "3314f339cf2180a2bd10fb7bcd57e29a";

const MINUTES_PER_HOUR = 60;
const DAY_ISO_LENGTH = 10;
const DECIMAL_FACTOR = 100;
const TASKS_LIMIT = 50;
/** Zona horaria del equipo (America/Guayaquil, sin DST). */
const TZ_OFFSET = "-05:00";

/** Nombres exactos de columnas en Notion. */
const PROP = {
  member: "Miembro del Equipo",
  memberText: "Miembro",
  responsable: "Responsable",
  worked: "Horas trabajadas",
  suma: "Suma de horas",
  jornada: "Jornada",
  tasks: "Tareas trabajadas",
} as const;

export function getJornadaDatabaseId(): string {
  return process.env.NOTION_JORNADA_DATABASE_ID?.trim() || DEFAULT_JORNADA_DATABASE_ID;
}

let cachedDataSourceId: string | null = null;

async function getJornadaDataSourceId(): Promise<string> {
  if (cachedDataSourceId) return cachedDataSourceId;

  const notion = getNotionClient();
  const db = await notion.request<{ data_sources: Array<{ id: string }> }>({
    path: `databases/${getJornadaDatabaseId()}`,
    method: "get",
  });

  const dsId = db.data_sources?.[0]?.id;
  if (!dsId) {
    throw new ServiceError("No se encontró data source para el Registro de Jornada.", 502);
  }

  cachedDataSourceId = dsId;
  return dsId;
}

/** Lista los miembros disponibles (opciones del select "Miembro del Equipo"). */
export async function listJornadaMembers(): Promise<string[]> {
  const notion = getNotionClient();
  const dsId = await getJornadaDataSourceId();

  const ds = await notion.request<{
    properties?: Record<string, { type?: string; select?: { options?: Array<{ name: string }> } }>;
  }>({ path: `data_sources/${dsId}`, method: "get" });

  const options = ds.properties?.[PROP.member]?.select?.options ?? [];
  return options.map((o) => o.name);
}

/** Parsea "5H 00M" / "5H" / "45M" a minutos totales. */
export function parseSumaHoras(text: string): number {
  if (!text) return 0;
  const hoursMatch = text.match(/(\d+)\s*H/i);
  const minutesMatch = text.match(/(\d+)\s*M/i);
  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
  return hours * MINUTES_PER_HOUR + minutes;
}

/** Formatea minutos como "Xh Ym". */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/**
 * Suma/resta días a una fecha "YYYY-MM-DD" (aritmética en UTC para evitar DST).
 * Se usa para ampliar la ventana del filtro de Notion, que compara "Horas
 * trabajadas" en UTC: una jornada nocturna en -05:00 (ej. 21:00) cae en el día
 * siguiente en UTC, así que ensanchamos ±1 día y luego filtramos por fecha local.
 */
function addDaysISO(iso: string, delta: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type NotionJornadaPage = {
  id: string;
  properties: Record<string, unknown>;
};

function readTitle(props: Record<string, unknown>, name: string): string {
  const prop = props[name] as { title?: Array<{ plain_text?: string }> } | undefined;
  return prop?.title?.map((t) => t.plain_text ?? "").join("").trim() ?? "";
}

function readSelect(props: Record<string, unknown>, name: string): string {
  const prop = props[name] as { select?: { name?: string } | null } | undefined;
  return prop?.select?.name ?? "";
}

function readFormulaString(props: Record<string, unknown>, name: string): string {
  const prop = props[name] as
    | { formula?: { type?: string; string?: string | null; number?: number | null } }
    | undefined;
  return prop?.formula?.string ?? "";
}

function readDateRange(
  props: Record<string, unknown>,
  name: string
): { start: string | null; end: string | null } {
  const prop = props[name] as { date?: { start?: string; end?: string | null } | null } | undefined;
  return { start: prop?.date?.start ?? null, end: prop?.date?.end ?? null };
}

function readRelationIds(props: Record<string, unknown>, name: string): string[] {
  const prop = props[name] as { relation?: Array<{ id?: string }> } | undefined;
  return (prop?.relation ?? []).map((r) => r.id).filter((id): id is string => Boolean(id));
}

function toEntry(page: NotionJornadaPage): JornadaEntry {
  const { start, end } = readDateRange(page.properties, PROP.worked);
  const sumaText = readFormulaString(page.properties, PROP.suma);
  return {
    id: page.id,
    jornada: readTitle(page.properties, PROP.jornada),
    member: readSelect(page.properties, PROP.member),
    date: start ? start.slice(0, DAY_ISO_LENGTH) : "",
    start,
    end,
    sumaText,
    minutes: parseSumaHoras(sumaText),
    taskIds: readRelationIds(page.properties, PROP.tasks),
  };
}

async function queryEntries(
  dsId: string,
  member: string,
  periodStart: string,
  periodEnd: string
): Promise<NotionJornadaPage[]> {
  const notion = getNotionClient();
  const results: NotionJornadaPage[] = [];
  let cursor: string | undefined;

  // Notion compara la fecha en UTC; ensanchamos ±1 día para no perder jornadas
  // nocturnas (-05:00) que caen en el día UTC siguiente. El filtro exacto por
  // fecha local se hace en getJornadaTotals.
  const filter = {
    and: [
      { property: PROP.member, select: { equals: member } },
      { property: PROP.worked, date: { on_or_after: addDaysISO(periodStart, -1) } },
      { property: PROP.worked, date: { on_or_before: addDaysISO(periodEnd, 1) } },
    ],
  };

  do {
    const response = await notion.request<{
      results: NotionJornadaPage[];
      has_more: boolean;
      next_cursor: string | null;
    }>({
      path: `data_sources/${dsId}/query`,
      method: "post",
      body: { filter, start_cursor: cursor, page_size: 100 },
    });
    results.push(...response.results);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return results;
}

/**
 * Total de horas de un miembro entre dos fechas (rango del calendario).
 * Suma la columna "Suma de horas" (fórmula "XH YYM") de las jornadas cuyo día
 * local cae dentro de [periodStart, periodEnd] (inclusive). Fechas en YYYY-MM-DD.
 */
export async function getJornadaTotals(
  member: string,
  periodStart: string,
  periodEnd: string
): Promise<JornadaTotals> {
  if (!member) {
    throw new ServiceError("Selecciona un miembro del equipo.", 400);
  }
  if (periodStart > periodEnd) {
    throw new ServiceError("La fecha inicial no puede ser posterior a la final.", 400);
  }

  const dsId = await getJornadaDataSourceId();
  const pages = await queryEntries(dsId, member, periodStart, periodEnd);

  const entries = pages
    .map(toEntry)
    .filter((e) => e.date && e.date >= periodStart && e.date <= periodEnd)
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);

  return {
    member,
    periodStart,
    periodEnd,
    totalMinutes,
    totalLabel: formatMinutes(totalMinutes),
    totalDecimalHours: Math.round((totalMinutes / MINUTES_PER_HOUR) * DECIMAL_FACTOR) / DECIMAL_FACTOR,
    count: entries.length,
    entries,
  };
}

// ---------------------------------------------------------------------------
// Registrar jornada (escritura append-only en la BD)
// ---------------------------------------------------------------------------

let cachedTasksDataSourceId: string | null = null;

async function getTasksDataSourceId(): Promise<string> {
  if (cachedTasksDataSourceId) return cachedTasksDataSourceId;

  const { databaseId } = getNotionConfig();
  const notion = getNotionClient();
  const db = await notion.request<{ data_sources: Array<{ id: string }> }>({
    path: `databases/${databaseId}`,
    method: "get",
  });

  const dsId = db.data_sources?.[0]?.id;
  if (!dsId) {
    throw new ServiceError(`No se encontró data source para la BD de Tareas (${databaseId}).`, 502);
  }

  cachedTasksDataSourceId = dsId;
  return dsId;
}

/**
 * Lista tareas candidatas a enlazar. Si `responsableId` viene, filtra por
 * "mis tareas" (Responsable contiene ese usuario). Si `onlyCurrentSprint`,
 * limita al sprint actual. Sin filtros, devuelve las más recientes.
 */
export async function listMyTasks(
  responsableId?: string,
  onlyCurrentSprint?: boolean
): Promise<{
  tasks: JornadaTaskOption[];
  sprintLabel: string | null;
  filterLabel: string;
}> {
  const config = getNotionConfig();
  const assigneeProp = getTeamNotionProps().assignee;
  const notion = getNotionClient();
  const dsId = await getTasksDataSourceId();

  const conditions: Array<Record<string, unknown>> = [];
  let sprintLabel: string | null = null;

  if (responsableId) {
    conditions.push({ property: assigneeProp, people: { contains: responsableId } });
  }
  if (onlyCurrentSprint) {
    const sprintId = await resolveCurrentSprintId();
    if (sprintId) {
      conditions.push({ property: config.props.sprint, relation: { contains: sprintId } });
      sprintLabel = await resolveSprintTitle(sprintId);
    }
  }

  const body: Record<string, unknown> = {
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    page_size: TASKS_LIMIT,
  };
  if (conditions.length === 1) body.filter = conditions[0];
  else if (conditions.length > 1) body.filter = { and: conditions };

  const response = await notion.request<{
    results: Array<{ id: string; properties: Record<string, unknown> }>;
  }>({ path: `data_sources/${dsId}/query`, method: "post", body });

  const out: JornadaTaskOption[] = [];
  for (const page of response.results) {
    const title = readTitle(page.properties, config.props.title);
    if (!title) continue;
    out.push({
      id: page.id,
      title,
      ticketType: readSelect(page.properties, config.props.ticketType),
    });
  }

  const parts: string[] = [];
  if (responsableId) parts.push("filtrado por responsable");
  if (onlyCurrentSprint) {
    parts.push(sprintLabel ? `sprint «${sprintLabel}»` : "sprint actual");
  }
  if (parts.length === 0) parts.push("tareas recientes (sin filtro)");

  return {
    tasks: out,
    sprintLabel,
    filterLabel: `${out.length} tarea(s) · ${parts.join(" · ")}`,
  };
}

async function resolveSprintTitle(sprintId: string): Promise<string | null> {
  try {
    const notion = getNotionClient();
    const page = await notion.request<{
      properties?: Record<string, { type?: string; title?: Array<{ plain_text?: string }> }>;
    }>({ path: `pages/${sprintId}`, method: "get" });
    const titleProp = Object.values(page.properties ?? {}).find((p) => p.type === "title");
    const name = titleProp?.title?.map((t) => t.plain_text ?? "").join("").trim() ?? "";
    return name || null;
  } catch {
    return null;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_HOURS = 24;
const MS_PER_MINUTE = 60000;

function buildRangeFromInput(input: {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}): { startISO: string; endISO: string; totalMinutes: number } {
  if (!DATE_RE.test(input.startDate) || !DATE_RE.test(input.endDate)) {
    throw new ServiceError("Fecha inválida (usa YYYY-MM-DD).", 400);
  }
  if (!TIME_RE.test(input.startTime) || !TIME_RE.test(input.endTime)) {
    throw new ServiceError("Hora inválida (usa HH:MM en formato 24h).", 400);
  }

  const startISO = `${input.startDate}T${input.startTime}:00.000${TZ_OFFSET}`;
  const endISO = `${input.endDate}T${input.endTime}:00.000${TZ_OFFSET}`;
  const startMs = Date.parse(startISO);
  const endMs = Date.parse(endISO);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new ServiceError("Fecha u hora inválida.", 400);
  }
  const totalMinutes = Math.round((endMs - startMs) / MS_PER_MINUTE);
  if (totalMinutes <= 0) {
    throw new ServiceError("El fin debe ser posterior al inicio.", 400);
  }
  if (totalMinutes > MAX_HOURS * MINUTES_PER_HOUR) {
    throw new ServiceError("La jornada no puede superar 24 horas; divídela en dos.", 400);
  }
  return { startISO, endISO, totalMinutes };
}

/**
 * Crea una jornada (una fila) enlazando varias tareas y el rango real
 * inicio → fin. Append-only: no modifica esquema ni filas existentes.
 * "Suma de horas" la calcula Notion desde el rango. Se guarda con offset
 * -05:00 (hora local del equipo). Devuelve la página y el total.
 */
export async function createJornadaEntry(
  input: CreateJornadaInput
): Promise<{ id: string; url: string; totalLabel: string }> {
  const member = input.member?.trim();
  const title = input.title?.trim();

  if (!member) throw new ServiceError("Selecciona un miembro del equipo.", 400);
  if (!title) throw new ServiceError("Escribe un título para la jornada.", 400);

  const { startISO, endISO, totalMinutes } = buildRangeFromInput(input);

  const properties: Record<string, unknown> = {
    [PROP.jornada]: notionTitle(title),
    [PROP.member]: notionSelect(member),
    [PROP.memberText]: notionRichText(member),
    [PROP.worked]: { date: { start: startISO, end: endISO } },
  };
  const taskIds = input.taskIds.filter(Boolean);
  if (taskIds.length > 0) properties[PROP.tasks] = notionRelation(taskIds);
  if (input.responsableId) properties[PROP.responsable] = notionPeople([input.responsableId]);

  const notion = getNotionClient();
  try {
    const page = await notion.pages.create({
      parent: { database_id: getJornadaDatabaseId() },
      properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
    });
    const url = "url" in page && typeof page.url === "string" ? page.url : "";
    return { id: page.id, url, totalLabel: formatMinutes(totalMinutes) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido de Notion.";
    throw new ServiceError(
      `No se pudo crear la jornada en Notion. Verifica que la integración tenga acceso de edición a «Registro de Jornada Diaria». Detalle: ${message}`,
      502
    );
  }
}

/**
 * Actualiza título, rango horario y/o tareas de una jornada existente.
 * No toca el esquema ni otras filas. Devuelve la entrada actualizada.
 */
export async function updateJornadaEntry(
  input: UpdateJornadaInput
): Promise<{ id: string; url: string; totalLabel: string; entry: JornadaEntry }> {
  const pageId = input.pageId?.trim();
  if (!pageId) throw new ServiceError("Falta el id de la jornada.", 400);

  const properties: Record<string, unknown> = {};
  let totalMinutes: number | null = null;

  if (typeof input.title === "string") {
    const title = input.title.trim();
    if (!title) throw new ServiceError("El título no puede quedar vacío.", 400);
    properties[PROP.jornada] = notionTitle(title);
  }

  const hasRange =
    Boolean(input.startDate) ||
    Boolean(input.startTime) ||
    Boolean(input.endDate) ||
    Boolean(input.endTime);
  if (hasRange) {
    if (!input.startDate || !input.startTime || !input.endDate || !input.endTime) {
      throw new ServiceError("Para cambiar el tiempo envía fecha/hora de inicio y de fin.", 400);
    }
    const range = buildRangeFromInput({
      startDate: input.startDate,
      startTime: input.startTime,
      endDate: input.endDate,
      endTime: input.endTime,
    });
    properties[PROP.worked] = { date: { start: range.startISO, end: range.endISO } };
    totalMinutes = range.totalMinutes;
  }

  if (Array.isArray(input.taskIds)) {
    properties[PROP.tasks] = notionRelation(input.taskIds.filter(Boolean));
  }

  if (Object.keys(properties).length === 0) {
    throw new ServiceError("No hay cambios para guardar.", 400);
  }

  const notion = getNotionClient();
  try {
    const page = await notion.pages.update({
      page_id: pageId,
      properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
    });
    const url = "url" in page && typeof page.url === "string" ? page.url : "";
    const entry = toEntry(page as NotionJornadaPage);
    return {
      id: page.id,
      url,
      totalLabel: totalMinutes != null ? formatMinutes(totalMinutes) : formatMinutes(entry.minutes),
      entry,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido de Notion.";
    throw new ServiceError(
      `No se pudo actualizar la jornada en Notion. Detalle: ${message}`,
      502
    );
  }
}
