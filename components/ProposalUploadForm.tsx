"use client";

import { useEffect, useRef, useState } from "react";
import type { PropuestaApiResponse } from "@/app/api/propuestas/route";
import { DocumentDropInput } from "@/components/DocumentDropInput";
import { DEFAULT_PM_ASSIGNEE_IDS } from "@/lib/propuesta-defaults";
import type { TeamOptionsApiResponse, TeamUserOption } from "@/lib/team-types";
import { TEAM_PRIORITIES } from "@/lib/team-types";

type Status = "idle" | "loading" | "success" | "error";

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

const fieldClasses =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] " +
  "shadow-[0_1px_2px_rgba(15,15,15,0.04)] outline-none transition " +
  "focus:border-[#b9b9b7] focus:ring-2 focus:ring-[#2383e2]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function ProposalUploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [hasFile, setHasFile] = useState(false);
  const [createdTitle, setCreatedTitle] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [priority, setPriority] = useState("Media");

  const [users, setUsers] = useState<TeamUserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [assignees, setAssignees] = useState<string[]>([...DEFAULT_PM_ASSIGNEE_IDS]);
  const [reviewers, setReviewers] = useState<string[]>([]);

  const loading = status === "loading";

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/tareas/opciones");
        const data = (await res.json()) as TeamOptionsApiResponse;
        if (active && res.ok && data.ok) setUsers(data.users);
      } catch {
        // silencioso
      } finally {
        if (active) setLoadingUsers(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function toggleAssignee(id: string) {
    setAssignees((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  function toggleReviewer(id: string) {
    setReviewers((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || !hasFile) return;

    if (assignees.length === 0) {
      setErrorMsg("Selecciona al menos un responsable.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("assignees", JSON.stringify(assignees));
      formData.set("reviewers", JSON.stringify(reviewers));
      formData.set("priority", priority);

      const res = await fetch("/api/propuestas", { method: "POST", body: formData });
      const data = (await res.json()) as PropuestaApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMsg(!data.ok ? data.error : `Error ${res.status}`);
        setStatus("error");
        return;
      }

      setCreatedTitle(data.taskTitle);
      setCreatedUrl(data.pageUrl);
      setStatus("success");
    } catch {
      setErrorMsg("No se pudo procesar la propuesta. Revisa tu conexión e inténtalo de nuevo.");
      setStatus("error");
    }
  }

  function resetForm() {
    formRef.current?.reset();
    setHasFile(false);
    setAssignees([...DEFAULT_PM_ASSIGNEE_IDS]);
    setReviewers([]);
    setPriority("Media");
    setCreatedTitle("");
    setCreatedUrl(null);
    setStatus("idle");
    setErrorMsg("");
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-[#efefef] bg-white p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#edf7ee]">
            <svg className="h-5 w-5 text-[#448361]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-[#37352f]">Propuesta creada</h2>
          <p className="mt-1 text-sm text-[#787774]">La tarea quedó en Notion con estado Por Revisar.</p>
        </div>

        <div className="mt-4 rounded-md bg-[#f7f7f5] px-3 py-2 text-sm">
          <p className="font-medium text-[#37352f]">{createdTitle}</p>
          {createdUrl && (
            <a
              href={createdUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[#2383e2] hover:underline"
            >
              Ver en Notion
            </a>
          )}
        </div>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center justify-center rounded-md border border-[#efefef] bg-white px-4 py-2 text-sm font-medium text-[#37352f] transition hover:bg-[#f7f7f5]"
          >
            Subir otra propuesta
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-[#efefef] bg-white p-5"
    >
      <DocumentDropInput
        disabled={loading}
        label="Propuesta (PDF o DOCX)"
        hint="Arrastra el PDF o DOCX aquí, o haz clic para elegirlo."
        onFileChange={(f) => setHasFile(Boolean(f))}
      />

      <div>
        <label htmlFor="priority" className={labelClasses}>Prioridad</label>
        <select
          id="priority"
          name="priority"
          disabled={loading}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={fieldClasses}
        >
          {TEAM_PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div>
        <span className={labelClasses}>Responsables</span>
        {loadingUsers ? (
          <p className="text-sm text-[#9b9a97]">Cargando equipo…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {users.map((u) => {
              const active = assignees.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={loading}
                  onClick={() => toggleAssignee(u.id)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition " +
                    (active
                      ? "border-[#2383e2] bg-[#e8f3fc] text-[#1a73d1]"
                      : "border-[#efefef] bg-white text-[#787774] hover:border-[#d3d1cb]")
                  }
                >
                  {u.name}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-1.5 text-xs text-[#9b9a97]">Toca para seleccionar uno o varios responsables.</p>
      </div>

      <div>
        <span className={labelClasses}>Revisores</span>
        {loadingUsers ? (
          <p className="text-sm text-[#9b9a97]">Cargando equipo…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {users.map((u) => {
              const active = reviewers.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={loading}
                  onClick={() => toggleReviewer(u.id)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition " +
                    (active
                      ? "border-[#2383e2] bg-[#e8f3fc] text-[#1a73d1]"
                      : "border-[#efefef] bg-white text-[#787774] hover:border-[#d3d1cb]")
                  }
                >
                  {u.name}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-1.5 text-xs text-[#9b9a97]">Toca para seleccionar uno o varios revisores.</p>
      </div>

      {status === "error" && (
        <div className="rounded-md border border-[#ffe2dd] bg-[#fdf0ef] px-3 py-2 text-sm text-[#b5403a]">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !hasFile}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2383e2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a73d1] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading && <Spinner />}
        {loading ? "Leyendo propuesta y creando tarea…" : "Crear propuesta en Notion"}
      </button>
    </form>
  );
}
