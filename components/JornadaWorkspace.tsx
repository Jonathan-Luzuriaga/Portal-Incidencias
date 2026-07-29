"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CreateJornadaInput,
  JornadaApiResponse,
  JornadaCreateResponse,
  JornadaEntry,
  JornadaOptionsResponse,
  JornadaTaskOption,
  JornadaTasksResponse,
  JornadaTotals,
  JornadaUpdateResponse,
  JornadaUserOption,
  UpdateJornadaInput,
} from "@/lib/jornada-types";

function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function firstOfMonthISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-01`;
}

/** Formatea "YYYY-MM-DD" como "DD/MM/YYYY". */
function formatDMY(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Parte un ISO con offset local (ej. 2026-07-28T21:00:00.000-05:00). */
function splitIsoLocal(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: todayISO(), time: "09:00" };
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return { date: todayISO(), time: "09:00" };
  return { date: m[1], time: `${m[2]}:${m[3]}` };
}

const inputClass =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] outline-none focus:border-[#c7c7c4]";
const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-[#9b9a97]";
const primaryBtn =
  "rounded-md bg-[#37352f] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2925] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtn =
  "rounded-md border border-[#efefef] bg-white px-3 py-1.5 text-sm text-[#37352f] hover:bg-[#f7f7f5] disabled:cursor-not-allowed disabled:opacity-50";

const MINUTE_STEP = 5;
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES_STEP = Array.from({ length: 60 / MINUTE_STEP }, (_, i) =>
  String(i * MINUTE_STEP).padStart(2, "0")
);

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

type Tab = "registrar" | "consultar";

export default function JornadaWorkspace() {
  const [tab, setTab] = useState<Tab>("registrar");
  const [members, setMembers] = useState<string[]>([]);
  const [membersError, setMembersError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/jornada/opciones");
        const data = (await res.json()) as JornadaOptionsResponse;
        if (!cancelled && res.ok && data.ok) setMembers(data.members ?? []);
        else if (!cancelled) setMembersError(data.error || "No se pudieron cargar los miembros.");
      } catch {
        if (!cancelled) setMembersError("Error de red al cargar miembros.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b border-[#efefef]">
        <TabButton active={tab === "registrar"} onClick={() => setTab("registrar")}>
          Registrar
        </TabButton>
        <TabButton active={tab === "consultar"} onClick={() => setTab("consultar")}>
          Consultar
        </TabButton>
      </div>

      {membersError ? <p className="text-sm text-red-700">{membersError}</p> : null}

      {tab === "registrar" ? (
        <RegistrarTab members={members} />
      ) : (
        <ConsultarTab members={members} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base = "px-3 py-2 text-sm font-medium -mb-px border-b-2";
  const cls = active
    ? `${base} border-[#37352f] text-[#37352f]`
    : `${base} border-transparent text-[#9b9a97] hover:text-[#37352f]`;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

function MemberSelect({
  id,
  members,
  value,
  onChange,
}: {
  id: string;
  members: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecciona un miembro…</option>
      {members.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}

/** Selector de hora en formato 24h (HH:MM) con desplegables 00–23 y minutos. */
function TimeSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [hRaw, mRaw] = value.split(":");
  const h = hRaw ?? "00";
  const m = mRaw ?? "00";
  const minuteOptions = MINUTES_STEP.includes(m) ? MINUTES_STEP : [m, ...MINUTES_STEP];
  return (
    <div className="flex items-center gap-2">
      <select
        id={id}
        className={inputClass}
        value={h}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
      >
        {HOURS_24.map((hh) => (
          <option key={hh} value={hh}>
            {hh}
          </option>
        ))}
      </select>
      <span className="text-[#787774]">:</span>
      <select
        className={inputClass}
        value={m}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
      >
        {minuteOptions.map((mm) => (
          <option key={mm} value={mm}>
            {mm}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Duración "Xh Ym" del rango inicio → fin; vacío si es inválido o <= 0. */
function rangeLabel(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
): string {
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return "";
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) return "";
  const start = Date.parse(`${startDate}T${startTime}:00`);
  const end = Date.parse(`${endDate}T${endTime}:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
  const diff = Math.round((end - start) / MS_PER_MINUTE);
  if (diff <= 0) return "";
  const h = Math.floor(diff / MINUTES_PER_HOUR);
  const m = diff % MINUTES_PER_HOUR;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// ---------------------------------------------------------------------------
// Lista de tareas con filtro visible
// ---------------------------------------------------------------------------

function TaskPicker({
  tasks,
  selected,
  onToggle,
  loading,
  filterLabel,
  search,
  onSearchChange,
}: {
  tasks: JornadaTaskOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  loading: boolean;
  filterLabel: string;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.ticketType.toLowerCase().includes(q)
    );
  }, [tasks, search]);

  return (
    <div>
      <label className={labelClass}>Tareas trabajadas</label>
      <p className="mb-2 text-xs text-[#9b9a97]">{filterLabel || "—"}</p>
      <input
        type="search"
        className={`${inputClass} mb-2`}
        placeholder="Buscar en la lista cargada…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        disabled={loading}
      />
      <div className="max-h-60 overflow-y-auto rounded-md border border-[#efefef]">
        {loading ? (
          <p className="p-3 text-sm text-[#787774]">Cargando tareas con el filtro actual…</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-sm text-[#787774]">No hay tareas para el filtro actual.</p>
        ) : (
          <ul key={filterLabel}>
            {filtered.map((t) => (
              <li key={t.id} className="border-b border-[#f3f3f1] last:border-0">
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[#f7f7f5]">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => onToggle(t.id)}
                  />
                  <span className="text-[#37352f]">{t.title}</span>
                  {t.ticketType ? (
                    <span className="ml-auto rounded bg-[#f3f3f1] px-2 py-0.5 text-xs text-[#787774]">
                      {t.ticketType}
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-1 text-xs text-[#9b9a97]">
        {selected.size} seleccionada(s) · mostrando {filtered.length} de {tasks.length}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Registrar
// ---------------------------------------------------------------------------

function RegistrarTab({ members }: { members: string[] }) {
  const [member, setMember] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(todayISO());
  const [endTime, setEndTime] = useState("13:00");
  const [responsable, setResponsable] = useState("");
  const [onlySprint, setOnlySprint] = useState(false);
  const [title, setTitle] = useState("");
  const [taskSearch, setTaskSearch] = useState("");

  const [users, setUsers] = useState<JornadaUserOption[]>([]);
  const [tasks, setTasks] = useState<JornadaTaskOption[]>([]);
  const [filterLabel, setFilterLabel] = useState("Cargando…");
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [tasksLoading, setTasksLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState<{ url: string; totalLabel: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (responsable) qs.set("responsable", responsable);
        if (onlySprint) qs.set("sprint", "1");
        const res = await fetch(`/api/jornada/tareas?${qs.toString()}`);
        const data = (await res.json()) as JornadaTasksResponse;
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setError(data.error || "No se pudieron cargar las tareas.");
          setTasks([]);
          setFilterLabel("Error al filtrar");
        } else {
          setError("");
          setTasks(data.tasks ?? []);
          setFilterLabel(data.filterLabel || `${data.tasks?.length ?? 0} tarea(s)`);
          if (data.users && data.users.length > 0) setUsers(data.users);
        }
      } catch {
        if (!cancelled) {
          setError("Error de red al cargar tareas.");
          setTasks([]);
        }
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [responsable, onlySprint]);

  function applyFilterChange(nextResponsable: string, nextSprint: boolean) {
    setTasks([]);
    setTasksLoading(true);
    setFilterLabel("Aplicando filtro…");
    setTaskSearch("");
    setSelectedTasks(new Set());
    setResponsable(nextResponsable);
    setOnlySprint(nextSprint);
  }

  function toggleTask(id: string) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const durationLabel = useMemo(
    () => rangeLabel(startDate, startTime, endDate, endTime),
    [startDate, startTime, endDate, endTime]
  );
  const canSave = member.trim().length > 0 && title.trim().length > 0 && Boolean(durationLabel) && !saving;

  async function guardar() {
    setSaving(true);
    setError("");
    setOk(null);
    try {
      const payload: CreateJornadaInput = {
        member,
        title,
        startDate,
        startTime,
        endDate,
        endTime,
        taskIds: [...selectedTasks],
        responsableId: responsable || undefined,
      };
      const res = await fetch("/api/jornada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as JornadaCreateResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo registrar la jornada.");
        return;
      }
      setOk({ url: data.page?.url ?? "", totalLabel: data.totalLabel ?? "" });
      setSelectedTasks(new Set());
      setTitle("");
    } catch {
      setError("Error de red al registrar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-[#efefef] bg-white p-5">
      <div>
        <label className={labelClass} htmlFor="reg-miembro">
          Miembro del equipo
        </label>
        <MemberSelect id="reg-miembro" members={members} value={member} onChange={setMember} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="reg-fecha-inicio">
            Fecha inicio
          </label>
          <input
            id="reg-fecha-inicio"
            type="date"
            className={inputClass}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="reg-hora-inicio">
            Hora inicio (24h)
          </label>
          <TimeSelect id="reg-hora-inicio" value={startTime} onChange={setStartTime} />
        </div>
        <div>
          <label className={labelClass} htmlFor="reg-fecha-fin">
            Fecha fin
          </label>
          <input
            id="reg-fecha-fin"
            type="date"
            className={inputClass}
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="reg-hora-fin">
            Hora fin (24h)
          </label>
          <TimeSelect id="reg-hora-fin" value={endTime} onChange={setEndTime} />
        </div>
      </div>

      <p className="text-sm text-[#787774]">
        Total:{" "}
        <span className="font-medium text-[#37352f]">{durationLabel || "—"}</span>
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="reg-responsable">
            Responsable (para filtrar tus tareas)
          </label>
          <select
            id="reg-responsable"
            className={inputClass}
            value={responsable}
            onChange={(e) => applyFilterChange(e.target.value, onlySprint)}
          >
            <option value="">Tareas recientes (sin filtrar)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-[#37352f]">
            <input
              type="checkbox"
              checked={onlySprint}
              onChange={(e) => applyFilterChange(responsable, e.target.checked)}
            />
            Solo sprint actual
          </label>
        </div>
      </div>

      <TaskPicker
        tasks={tasks}
        selected={selectedTasks}
        onToggle={toggleTask}
        loading={tasksLoading}
        filterLabel={filterLabel}
        search={taskSearch}
        onSearchChange={setTaskSearch}
      />

      <div>
        <label className={labelClass} htmlFor="reg-titulo">
          Título de la jornada
        </label>
        <input
          id="reg-titulo"
          type="text"
          className={inputClass}
          value={title}
          placeholder="Ej. Ajustes portal + reunión PM"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="button" disabled={!canSave} onClick={guardar} className={primaryBtn}>
          {saving ? "Guardando…" : "Registrar jornada"}
        </button>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {ok ? (
          <p className="text-sm text-green-700">
            Jornada registrada ({ok.totalLabel}).{" "}
            {ok.url ? (
              <a href={ok.url} target="_blank" rel="noreferrer" className="underline">
                Ver en Notion
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Consultar + editar
// ---------------------------------------------------------------------------

function ConsultarTab({ members }: { members: string[] }) {
  const [member, setMember] = useState("");
  const [desde, setDesde] = useState(firstOfMonthISO());
  const [hasta, setHasta] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totals, setTotals] = useState<JornadaTotals | null>(null);

  const canSubmit = member.trim().length > 0 && Boolean(desde) && Boolean(hasta) && !loading;

  async function calcular() {
    setLoading(true);
    setError("");
    setTotals(null);
    try {
      const qs = new URLSearchParams({ miembro: member, desde, hasta });
      const res = await fetch(`/api/jornada?${qs.toString()}`);
      const data = (await res.json()) as JornadaApiResponse;
      if (!res.ok || !data.ok || !data.totals) {
        setError(data.error || "No se pudo calcular el total.");
        return;
      }
      setTotals(data.totals);
    } catch {
      setError("Error de red al calcular.");
    } finally {
      setLoading(false);
    }
  }

  function onEntryUpdated(entry: JornadaEntry) {
    setTotals((prev) => {
      if (!prev) return prev;
      const entries = prev.entries.map((e) => (e.id === entry.id ? entry : e));
      const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
      const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
      const mins = totalMinutes % MINUTES_PER_HOUR;
      return {
        ...prev,
        entries,
        totalMinutes,
        count: entries.length,
        totalLabel: `${hours}h ${String(mins).padStart(2, "0")}m`,
        totalDecimalHours: Math.round((totalMinutes / MINUTES_PER_HOUR) * 100) / 100,
      };
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#efefef] bg-white p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="con-miembro">
              Miembro del equipo
            </label>
            <MemberSelect id="con-miembro" members={members} value={member} onChange={setMember} />
          </div>
          <div>
            <label className={labelClass} htmlFor="con-desde">
              Desde
            </label>
            <input
              id="con-desde"
              type="date"
              className={inputClass}
              value={desde}
              max={hasta || undefined}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="con-hasta">
              Hasta
            </label>
            <input
              id="con-hasta"
              type="date"
              className={inputClass}
              value={hasta}
              min={desde || undefined}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-[#9b9a97]">
          Selecciona el rango de fechas (ambas inclusive). Se suma la columna «Suma de horas»
          de las jornadas dentro del rango. Puedes editar título, horario y tareas de cada fila.
        </p>

        <button type="button" disabled={!canSubmit} onClick={calcular} className={`mt-4 ${primaryBtn}`}>
          {loading ? "Calculando…" : "Calcular horas"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>

      {totals ? <Results totals={totals} onEntryUpdated={onEntryUpdated} /> : null}
    </div>
  );
}

function Results({
  totals,
  onEntryUpdated,
}: {
  totals: JornadaTotals;
  onEntryUpdated: (entry: JornadaEntry) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-[#efefef] bg-[#f7f7f5] p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#9b9a97]">
            {totals.member} · {formatDMY(totals.periodStart)} → {formatDMY(totals.periodEnd)}
          </p>
          <p className="mt-1 text-3xl font-semibold text-[#37352f]">{totals.totalLabel}</p>
          <p className="mt-1 text-sm text-[#787774]">
            {totals.totalDecimalHours} horas · {totals.count} jornada(s)
          </p>
        </div>
      </div>

      {totals.entries.length === 0 ? (
        <p className="rounded-lg border border-[#efefef] bg-white p-5 text-sm text-[#787774]">
          No hay jornadas registradas en este rango.
        </p>
      ) : (
        <div className="space-y-3">
          {totals.entries.map((e) =>
            editingId === e.id ? (
              <EditJornadaForm
                key={e.id}
                entry={e}
                onCancel={() => setEditingId(null)}
                onSaved={(updated) => {
                  onEntryUpdated(updated);
                  setEditingId(null);
                }}
              />
            ) : (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#efefef] bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-[#37352f]">{e.jornada || "—"}</p>
                  <p className="text-xs text-[#9b9a97]">
                    {formatDMY(e.date)} · {e.sumaText || "—"} · {e.taskIds.length} tarea(s)
                  </p>
                </div>
                <button type="button" className={secondaryBtn} onClick={() => setEditingId(e.id)}>
                  Editar
                </button>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

function EditJornadaForm({
  entry,
  onCancel,
  onSaved,
}: {
  entry: JornadaEntry;
  onCancel: () => void;
  onSaved: (entry: JornadaEntry) => void;
}) {
  const start = splitIsoLocal(entry.start);
  const end = splitIsoLocal(entry.end ?? entry.start);

  const [title, setTitle] = useState(entry.jornada);
  const [startDate, setStartDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endDate, setEndDate] = useState(end.date);
  const [endTime, setEndTime] = useState(end.time);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set(entry.taskIds));
  const [tasks, setTasks] = useState<JornadaTaskOption[]>([]);
  const [filterLabel, setFilterLabel] = useState("Cargando tareas…");
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskSearch, setTaskSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/jornada/tareas");
        const data = (await res.json()) as JornadaTasksResponse;
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setError(data.error || "No se pudieron cargar las tareas.");
          setTasks([]);
        } else {
          // Incluye las ya enlazadas aunque no estén en el top reciente
          const byId = new Map((data.tasks ?? []).map((t) => [t.id, t]));
          for (const id of entry.taskIds) {
            if (!byId.has(id)) byId.set(id, { id, title: `(tarea enlazada) ${id.slice(0, 8)}…`, ticketType: "" });
          }
          setTasks([...byId.values()]);
          setFilterLabel(data.filterLabel || `${byId.size} tarea(s)`);
        }
      } catch {
        if (!cancelled) setError("Error de red al cargar tareas.");
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.id, entry.taskIds]);

  const durationLabel = useMemo(
    () => rangeLabel(startDate, startTime, endDate, endTime),
    [startDate, startTime, endDate, endTime]
  );

  function toggleTask(id: string) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function guardar() {
    if (!title.trim() || !durationLabel) return;
    setSaving(true);
    setError("");
    try {
      const payload: UpdateJornadaInput = {
        pageId: entry.id,
        title,
        startDate,
        startTime,
        endDate,
        endTime,
        taskIds: [...selectedTasks],
      };
      const res = await fetch("/api/jornada", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as JornadaUpdateResponse;
      if (!res.ok || !data.ok || !data.entry) {
        setError(data.error || "No se pudo actualizar la jornada.");
        return;
      }
      onSaved(data.entry);
    } catch {
      setError("Error de red al actualizar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-[#37352f] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#9b9a97]">Editar jornada</p>

      <div>
        <label className={labelClass} htmlFor={`edit-title-${entry.id}`}>
          Título
        </label>
        <input
          id={`edit-title-${entry.id}`}
          type="text"
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Fecha inicio</label>
          <input
            type="date"
            className={inputClass}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Hora inicio (24h)</label>
          <TimeSelect id={`edit-start-${entry.id}`} value={startTime} onChange={setStartTime} />
        </div>
        <div>
          <label className={labelClass}>Fecha fin</label>
          <input
            type="date"
            className={inputClass}
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Hora fin (24h)</label>
          <TimeSelect id={`edit-end-${entry.id}`} value={endTime} onChange={setEndTime} />
        </div>
      </div>

      <p className="text-sm text-[#787774]">
        Total: <span className="font-medium text-[#37352f]">{durationLabel || "—"}</span>
      </p>

      <TaskPicker
        tasks={tasks}
        selected={selectedTasks}
        onToggle={toggleTask}
        loading={tasksLoading}
        filterLabel={filterLabel}
        search={taskSearch}
        onSearchChange={setTaskSearch}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={primaryBtn}
          disabled={saving || !title.trim() || !durationLabel}
          onClick={guardar}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" className={secondaryBtn} disabled={saving} onClick={onCancel}>
          Cancelar
        </button>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
