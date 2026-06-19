"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EvidenceInput } from "./EvidenceInput";
import { SuccessPanel } from "./SuccessPanel";
import {
  DEFAULT_TEAM_CLIENT,
  DEFAULT_TEAM_CLIENT_PROJECT,
  DEFAULT_TEAM_PROJECT,
  TEAM_CATEGORY_OPTIONS,
  TEAM_CLIENT_PROJECT_OPTIONS,
  TEAM_PROJECT_OPTIONS,
  TEAM_TAG_SUGGESTIONS,
  resolveTeamClientProject,
  resolveTeamProject,
} from "@/lib/team-profiles";
import type { FormattedTeamTask, TeamStructureApiResponse, TeamTaskApiResponse } from "@/lib/team-types";
import {
  TEAM_CLIENTS,
  TEAM_PRIORITIES,
  TEAM_TICKET_TYPES,
  type TeamClient,
  type TeamPriority,
  type TeamTicketType,
} from "@/lib/team-types";

type Status = "idle" | "loading" | "structuring" | "success" | "error";

const fieldClasses =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] " +
  "shadow-[0_1px_2px_rgba(15,15,15,0.04)] outline-none transition " +
  "placeholder:text-[#9b9a97] focus:border-[#b9b9b7] focus:ring-2 focus:ring-[#2383e2]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

const sectionClasses = "space-y-4 border-t border-[#efefef] pt-4 first:border-t-0 first:pt-0";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#9b9a97]">{children}</h3>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function applyFormattedToForm(formatted: FormattedTeamTask, setters: {
  setTitle: (v: string) => void;
  setShortDescription: (v: string) => void;
  setBodyMarkdown: (v: string) => void;
  setTicketType: (v: TeamTicketType) => void;
  setPriority: (v: TeamPriority) => void;
  setClient: (v: TeamClient) => void;
  setClientProject: (v: string) => void;
  setCategory: (v: string) => void;
  setSelectedTags: (v: string[]) => void;
  setHours: (v: string) => void;
}) {
  setters.setTitle(formatted.title);
  setters.setShortDescription(formatted.shortDescription);
  setters.setBodyMarkdown(formatted.bodyMarkdown);
  setters.setTicketType(formatted.ticketType);
  setters.setPriority(formatted.priority);
  setters.setClient(formatted.client);
  setters.setClientProject(formatted.clientProject);
  setters.setCategory(formatted.category);
  setters.setSelectedTags(formatted.tags);
  if (formatted.hours != null) setters.setHours(String(formatted.hours));
}

export default function TeamTaskForm() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [created, setCreated] = useState<
    { pageId: string; pageUrl: string | null; taskTitle: string; evidenceCount: number }[]
  >([]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [rawInput, setRawInput] = useState("");
  const [aiStructured, setAiStructured] = useState(false);

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [ticketType, setTicketType] = useState<TeamTicketType>("Tarea");
  const [priority, setPriority] = useState<TeamPriority>("Media");
  const [client, setClient] = useState<TeamClient>(DEFAULT_TEAM_CLIENT);
  const [clientProject, setClientProject] = useState(DEFAULT_TEAM_CLIENT_PROJECT);
  const [projectRelationId, setProjectRelationId] = useState(DEFAULT_TEAM_PROJECT);
  const [category, setCategory] = useState<string>("Workflows");
  const [selectedTags, setSelectedTags] = useState<string[]>(["tareas"]);
  const [hours, setHours] = useState("");

  useEffect(() => {
    setClientProject(resolveTeamClientProject(searchParams.get("proyecto")));
    setProjectRelationId(resolveTeamProject(searchParams.get("proyecto_notion")));
  }, [searchParams]);

  const busy = status === "loading" || status === "structuring";

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleStructure() {
    if (!rawInput.trim() || busy) return;

    setStatus("structuring");
    setErrorMsg("");

    try {
      const res = await fetch("/api/tareas/estructurar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawDescription: rawInput, clientProject, client }),
      });

      const data = (await res.json()) as TeamStructureApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMsg(!data.ok ? data.error : `Error ${res.status}`);
        setStatus("error");
        return;
      }

      applyFormattedToForm(data.formatted, {
        setTitle,
        setShortDescription,
        setBodyMarkdown,
        setTicketType,
        setPriority,
        setClient,
        setClientProject,
        setCategory,
        setSelectedTags,
        setHours,
      });
      setAiStructured(true);
      setStatus("idle");
    } catch {
      setErrorMsg("No se pudo estructurar con IA. Revisa tu conexión e inténtalo de nuevo.");
      setStatus("error");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    setStatus("loading");
    setErrorMsg("");
    setCreated([]);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("tags", selectedTags.join(","));
      formData.set("rawInput", rawInput);
      formData.set("useAi", aiStructured ? "false" : rawInput.trim() ? "true" : "false");
      for (const file of evidenceFiles) {
        formData.append("images", file);
      }

      const res = await fetch("/api/tareas", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as TeamTaskApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMsg(!data.ok ? data.error : `Error ${res.status}`);
        setStatus("error");
        return;
      }

      setCreated([
        {
          pageId: data.pageId,
          pageUrl: data.pageUrl,
          taskTitle: data.taskTitle,
          evidenceCount: data.evidenceCount,
        },
      ]);
      setStatus("success");
    } catch {
      setErrorMsg("No se pudo crear la tarea. Revisa tu conexión e inténtalo de nuevo.");
      setStatus("error");
    }
  }

  function resetForm() {
    formRef.current?.reset();
    setEvidenceFiles([]);
    setRawInput("");
    setAiStructured(false);
    setTitle("");
    setShortDescription("");
    setBodyMarkdown("");
    setTicketType("Tarea");
    setPriority("Media");
    setClient(DEFAULT_TEAM_CLIENT);
    setCategory("Workflows");
    setSelectedTags(["tareas"]);
    setHours("");
    setStatus("idle");
    setErrorMsg("");
    setCreated([]);
  }

  if (status === "success") {
    return (
      <SuccessPanel
        title="Tarea creada"
        items={created}
        onReset={resetForm}
      />
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-[#efefef] bg-white p-5"
      noValidate
    >
      <div className={sectionClasses}>
        <SectionTitle>Descripción en bruto</SectionTitle>

        <div>
          <label htmlFor="rawInput" className={labelClasses}>
            Pega aquí tu idea, nota o bug informal
          </label>
          <textarea
            id="rawInput"
            name="rawInput"
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              setAiStructured(false);
            }}
            disabled={busy}
            rows={5}
            placeholder={"Ej. Necesitamos un endpoint para exportar congresos a Excel. QA reportó que el modal de seguimiento corta el texto en mobile.\n\nBug: al sincronizar planes en Zonales solo trae 10 de 53 registros."}
            className={`${fieldClasses} resize-y`}
          />
          <p className="mt-1.5 text-xs text-[#9b9a97]">
            La IA infiere título, tipo, prioridad, categoría, etiquetas y formatea el cuerpo de la tarea.
          </p>
        </div>

        <button
          type="button"
          disabled={busy || !rawInput.trim()}
          onClick={handleStructure}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#2383e2] bg-[#e8f3fc] px-4 py-2.5 text-sm font-medium text-[#1a73d1] transition hover:bg-[#d6ebfa] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "structuring" && <Spinner />}
          {status === "structuring" ? "Estructurando con IA…" : "Estructurar con IA"}
        </button>

        {aiStructured && (
          <p className="text-xs text-[#448361]">
            Campos rellenados. Revisa y ajusta antes de crear la tarea.
          </p>
        )}
      </div>

      <div className={sectionClasses}>
        <SectionTitle>Identificación</SectionTitle>

        <div>
          <label htmlFor="title" className={labelClasses}>Título</label>
          <input
            id="title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            placeholder="Ej. Implementar exportación Excel en módulo congresos"
            className={fieldClasses}
          />
        </div>

        <div>
          <label htmlFor="shortDescription" className={labelClasses}>Descripción corta</label>
          <textarea
            id="shortDescription"
            name="shortDescription"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            disabled={busy}
            rows={2}
            placeholder="Resumen para la columna Descripción en Notion (1–3 líneas)"
            className={`${fieldClasses} resize-y`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ticketType" className={labelClasses}>Tipo de ticket</label>
            <select
              id="ticketType"
              name="ticketType"
              required
              disabled={busy}
              value={ticketType}
              onChange={(e) => setTicketType(e.target.value as TeamTicketType)}
              className={fieldClasses}
            >
              {TEAM_TICKET_TYPES.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="priority" className={labelClasses}>Prioridad</label>
            <select
              id="priority"
              name="priority"
              required
              disabled={busy}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TeamPriority)}
              className={fieldClasses}
            >
              {TEAM_PRIORITIES.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={sectionClasses}>
        <SectionTitle>Clasificación</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="client" className={labelClasses}>Cliente</label>
            <select
              id="client"
              name="client"
              required
              disabled={busy}
              value={client}
              onChange={(e) => setClient(e.target.value as TeamClient)}
              className={fieldClasses}
            >
              {TEAM_CLIENTS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="category" className={labelClasses}>Categoría</label>
            <select
              id="category"
              name="category"
              required
              disabled={busy}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={fieldClasses}
            >
              {TEAM_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="clientProject" className={labelClasses}>Proyecto Cliente</label>
          <select
            id="clientProject"
            name="clientProject"
            required
            disabled={busy}
            value={clientProject}
            onChange={(e) => setClientProject(e.target.value)}
            className={fieldClasses}
          >
            {TEAM_CLIENT_PROJECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="projectRelationId" className={labelClasses}>Proyecto (Notion)</label>
          <select
            id="projectRelationId"
            name="projectRelationId"
            required
            disabled={busy}
            value={projectRelationId}
            onChange={(e) => setProjectRelationId(e.target.value)}
            className={fieldClasses}
          >
            {TEAM_PROJECT_OPTIONS.map((opt) => (
              <option key={opt.relationId} value={opt.relationId}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelClasses}>Etiquetas</span>
          <div className="flex flex-wrap gap-2">
            {TEAM_TAG_SUGGESTIONS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  disabled={busy}
                  onClick={() => toggleTag(tag)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition " +
                    (active
                      ? "border-[#2383e2] bg-[#e8f3fc] text-[#1a73d1]"
                      : "border-[#efefef] bg-[#f7f7f5] text-[#787774] hover:border-[#d3d1cb]")
                  }
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="tags" value={selectedTags.join(",")} />
        </div>
      </div>

      <div className={sectionClasses}>
        <SectionTitle>Detalle</SectionTitle>

        <div>
          <label htmlFor="bodyMarkdown" className={labelClasses}>
            Cuerpo de la tarea <span className="font-normal text-[#9b9a97]">(markdown)</span>
          </label>
          <textarea
            id="bodyMarkdown"
            name="bodyMarkdown"
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            disabled={busy}
            rows={8}
            placeholder={"## Contexto\n...\n\n## Objetivo\n...\n\n## Criterios de aceptación\n- ..."}
            className={`${fieldClasses} resize-y font-mono text-xs`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="prLink" className={labelClasses}>
              Enlace PR <span className="font-normal text-[#9b9a97]">(opcional)</span>
            </label>
            <input
              id="prLink"
              name="prLink"
              type="url"
              disabled={busy}
              placeholder="https://github.com/..."
              className={fieldClasses}
            />
          </div>
          <div>
            <label htmlFor="hours" className={labelClasses}>
              Horas estimadas <span className="font-normal text-[#9b9a97]">(opcional)</span>
            </label>
            <input
              id="hours"
              name="hours"
              type="number"
              min="0"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              disabled={busy}
              placeholder="Ej. 4"
              className={fieldClasses}
            />
          </div>
        </div>

        <EvidenceInput disabled={busy} onChange={setEvidenceFiles} />
      </div>

      {status === "error" && (
        <div className="rounded-md border border-[#ffe2dd] bg-[#fdf0ef] px-3 py-2 text-sm text-[#b5403a]">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || (!title.trim() && !rawInput.trim())}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2383e2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a73d1] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" && <Spinner />}
        {status === "loading" ? "Creando tarea…" : "Crear tarea en Notion"}
      </button>
    </form>
  );
}
