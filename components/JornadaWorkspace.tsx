"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CreateJornadaInput,
  JornadaApiResponse,
  JornadaCreateResponse,
  JornadaOptionsResponse,
  JornadaTaskOption,
  JornadaTasksResponse,
  JornadaTotals,
  JornadaUserOption,
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

const inputClass =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] outline-none focus:border-[#c7c7c4]";
const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-[#9b9a97]";
const primaryBtn =
  "rounded-md bg-[#37352f] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2925] disabled:cursor-not-allowed disabled:opacity-50";

const MINUTE_STEP = 5;
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES_STEP = Array.from({ length: 60 / MINUTE_STEP }, (_, i) =>
  String(i * MINUTE_STEP).padStart(2, "0")
);

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

  const [users, setUsers] = useState<JornadaUserOption[]>([]);
  const [tasks, setTasks] = useState<JornadaTaskOption[]>([]);
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
        } else {
          setError("");
          setTasks(data.tasks ?? []);
          if (data.users && data.users.length > 0) setUsers(data.users);
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
  }, [responsable, onlySprint]);

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
            onChange={(e) => setResponsable(e.target.value)}
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
              onChange={(e) => setOnlySprint(e.target.checked)}
            />
            Solo sprint actual
          </label>
        </div>
      </div>

      <div>
        <label className={labelClass}>Tareas trabajadas</label>
        <div className="max-h-60 overflow-y-auto rounded-md border border-[#efefef]">
          {tasksLoading ? (
            <p className="p-3 text-sm text-[#787774]">Cargando tareas…</p>
          ) : tasks.length === 0 ? (
            <p className="p-3 text-sm text-[#787774]">No hay tareas para el filtro actual.</p>
          ) : (
            <ul>
              {tasks.map((t) => (
                <li key={t.id} className="border-b border-[#f3f3f1] last:border-0">
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[#f7f7f5]">
                    <input
                      type="checkbox"
                      checked={selectedTasks.has(t.id)}
                      onChange={() => toggleTask(t.id)}
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
        <p className="mt-1 text-xs text-[#9b9a97]">{selectedTasks.size} tarea(s) seleccionada(s)</p>
      </div>

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

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
// Consultar
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
          de las jornadas dentro del rango.
        </p>

        <button type="button" disabled={!canSubmit} onClick={calcular} className={`mt-4 ${primaryBtn}`}>
          {loading ? "Calculando…" : "Calcular horas"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>

      {totals ? <Results totals={totals} /> : null}
    </div>
  );
}

function Results({ totals }: { totals: JornadaTotals }) {
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
        <div className="overflow-hidden rounded-lg border border-[#efefef] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#efefef] text-left text-xs uppercase tracking-wide text-[#9b9a97]">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Jornada</th>
                <th className="px-4 py-2 text-right font-medium">Suma de horas</th>
              </tr>
            </thead>
            <tbody>
              {totals.entries.map((e) => (
                <tr key={e.id} className="border-b border-[#f3f3f1] last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-[#37352f]">{formatDMY(e.date)}</td>
                  <td className="px-4 py-2 text-[#37352f]">{e.jornada || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right text-[#787774]">
                    {e.sumaText || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
