"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EvidenceInput } from "./EvidenceInput";
import { SuccessPanel } from "./SuccessPanel";
import {
  DEFAULT_TEAM_CLIENT_PROJECT,
  TEAM_CATEGORY_OPTIONS,
  TEAM_TAG_SUGGESTIONS,
} from "@/lib/team-profiles";
import type {
  CreatedTeamTaskSummary,
  TeamClientProjectOption,
  TeamEnvironment,
  TeamOptionsApiResponse,
  TeamProjectOption,
  TeamScope,
  TeamStructureApiResponse,
  TeamSubtaskInput,
  TeamTaskApiResponse,
  TeamTicketType,
  TeamUserOption,
} from "@/lib/team-types";
import { TEAM_ENVIRONMENTS, TEAM_PRIORITIES, TEAM_SCOPES } from "@/lib/team-types";

type Status = "idle" | "loading" | "structuring" | "success" | "error";

const fieldClasses =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] " +
  "shadow-[0_1px_2px_rgba(15,15,15,0.04)] outline-none transition " +
  "placeholder:text-[#9b9a97] focus:border-[#b9b9b7] focus:ring-2 focus:ring-[#2383e2]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

const sectionClasses = "space-y-4 border-t border-[#efefef] pt-4 first:border-t-0 first:pt-0";

const TICKET_TYPES: TeamTicketType[] = ["Tarea", "Bug", "Épica"];

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

function typeButtonClass(active: boolean) {
  return (
    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition " +
    (active
      ? "border-[#2383e2] bg-[#e8f3fc] text-[#1a73d1]"
      : "border-[#efefef] bg-[#f7f7f5] text-[#787774] hover:border-[#d3d1cb]")
  );
}

export default function TeamTaskForm() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [created, setCreated] = useState<CreatedTeamTaskSummary[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [aiPrepared, setAiPrepared] = useState(false);

  const [rawInput, setRawInput] = useState("");
  const [projectRelationId, setProjectRelationId] = useState("");
  const [clientProject, setClientProject] = useState(DEFAULT_TEAM_CLIENT_PROJECT);
  const [environment, setEnvironment] = useState<TeamEnvironment>("Desarrollo");
  const [scope, setScope] = useState<TeamScope>("Frontend");
  const [assigneeId, setAssigneeId] = useState("");
  const [ticketType, setTicketType] = useState<TeamTicketType>("Tarea");

  const [users, setUsers] = useState<TeamUserOption[]>([]);
  const [projects, setProjects] = useState<TeamProjectOption[]>([]);
  const [clientProjects, setClientProjects] = useState<TeamClientProjectOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState("");

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [priority, setPriority] = useState("Media");
  const [category, setCategory] = useState("Workflows");
  const [selectedTags, setSelectedTags] = useState<string[]>(["tareas"]);
  const [hours, setHours] = useState("");
  const [subtasks, setSubtasks] = useState<TeamSubtaskInput[]>([]);

  const busy = status === "loading" || status === "structuring";

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setOptionsError("");
    try {
      const res = await fetch("/api/tareas/opciones");
      const data = (await res.json()) as TeamOptionsApiResponse;
      if (!res.ok || !data.ok) {
        setOptionsError(!data.ok ? data.error : `Error ${res.status}`);
        return;
      }

      setUsers(data.users);
      setProjects(data.projects);
      setClientProjects(data.clientProjects);

      if (data.projects.length > 0) {
        const fromUrl = searchParams.get("proyecto_notion");
        const match = fromUrl
          ? data.projects.find((p) => p.relationId === fromUrl)
          : undefined;
        setProjectRelationId((current) => {
          if (current && data.projects.some((p) => p.relationId === current)) return current;
          return match?.relationId ?? data.projects[0].relationId;
        });
      }

      setClientProject((current) => {
        if (current && data.clientProjects.some((o) => o.value === current)) return current;
        return data.clientProjects[0]?.value ?? "";
      });
    } catch {
      setOptionsError("No se pudieron cargar opciones de Notion. Revisa la conexión.");
    } finally {
      setLoadingOptions(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const projectLabel =
    projects.find((p) => p.relationId === projectRelationId)?.label ?? "";

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function updateSubtask(index: number, patch: Partial<TeamSubtaskInput>) {
    setSubtasks((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSubtask() {
    setSubtasks((prev) => [
      ...prev,
      { title: "", shortDescription: "", enabled: true },
    ]);
  }

  function removeSubtask(index: number) {
    setSubtasks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePrepare() {
    if (!rawInput.trim() || busy) return;

    setStatus("structuring");
    setErrorMsg("");

    try {
      const res = await fetch("/api/tareas/estructurar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawDescription: rawInput,
          ticketType,
          projectRelationId,
          projectLabel,
          clientProject,
          environment,
          scope,
        }),
      });

      const data = (await res.json()) as TeamStructureApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMsg(!data.ok ? data.error : `Error ${res.status}`);
        setStatus("error");
        return;
      }

      const f = data.formatted;
      setTitle(f.title);
      setShortDescription(f.shortDescription);
      setBodyMarkdown(f.bodyMarkdown);
      setPriority(f.priority);
      setCategory(f.category);
      setSelectedTags(f.tags);
      if (f.hours != null) setHours(String(f.hours));
      setSubtasks(
        f.subtasks.map((s) => ({
          title: s.title,
          shortDescription: s.shortDescription,
          enabled: true,
        }))
      );
      setAiPrepared(true);
      setShowPreview(true);
      setStatus("idle");
    } catch {
      setErrorMsg("No se pudo preparar con IA. Revisa tu conexión e inténtalo de nuevo.");
      setStatus("error");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    if (!assigneeId) {
      setErrorMsg("Selecciona a quién se asigna la tarea.");
      setStatus("error");
      return;
    }
    if (!clientProject) {
      setErrorMsg("Selecciona el Proyecto Cliente.");
      setStatus("error");
      return;
    }
    if (!projectRelationId) {
      setErrorMsg("Selecciona un proyecto.");
      setStatus("error");
      return;
    }
    if (!rawInput.trim() && !title.trim()) {
      setErrorMsg("Describe la idea de la tarea.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setCreated([]);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("tags", selectedTags.join(","));
      formData.set("rawInput", rawInput);
      formData.set("subtasksJson", JSON.stringify(subtasks));
      formData.set("useAi", aiPrepared ? "false" : "true");
      formData.set("projectLabel", projectLabel);
      formData.set("clientProject", clientProject);
      formData.set("environment", environment);
      formData.set("scope", scope);
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

      setCreated(data.created ?? []);
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
    setAiPrepared(false);
    setShowPreview(false);
    setShowAdvanced(false);
    setTitle("");
    setShortDescription("");
    setBodyMarkdown("");
    setTicketType("Tarea");
    setPriority("Media");
    setCategory("Workflows");
    setSelectedTags(["tareas"]);
    setHours("");
    setSubtasks([]);
    setEnvironment("Desarrollo");
    setScope("Frontend");
    if (clientProjects.length > 0) {
      setClientProject(clientProjects[0].value);
    }
    if (projects.length > 0) {
      setProjectRelationId(projects[0].relationId);
    }
    setStatus("idle");
    setErrorMsg("");
    setCreated([]);
  }

  if (status === "success") {
    return (
      <SuccessPanel
        title={created.length > 1 ? "Tareas creadas" : "Tarea creada"}
        items={created}
        onReset={resetForm}
        resetLabel="Crear otra tarea"
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
      {/* --- Ingesta PM --- */}
      <div className={sectionClasses}>
        <SectionTitle>Ingesta</SectionTitle>

        <div>
          <label htmlFor="rawInput" className={labelClasses}>Tu idea</label>
          <textarea
            id="rawInput"
            name="rawInput"
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              setAiPrepared(false);
            }}
            disabled={busy}
            rows={4}
            required
            placeholder="Ej. Necesitamos exportar congresos a Excel. El modal de seguimiento corta texto en mobile."
            className={`${fieldClasses} resize-y`}
          />
        </div>

        <EvidenceInput disabled={busy} onChange={setEvidenceFiles} />

        <p className="text-xs text-[#9b9a97]">
          Proyecto y Proyecto Cliente son campos independientes en Notion; puedes combinarlos libremente.
        </p>

        <div>
          <label htmlFor="projectRelationId" className={labelClasses}>Proyecto</label>
          <select
            id="projectRelationId"
            name="projectRelationId"
            required
            disabled={busy || loadingOptions || projects.length === 0}
            value={projectRelationId}
            onChange={(e) => setProjectRelationId(e.target.value)}
            className={fieldClasses}
          >
            {projects.length === 0 ? (
              <option value="">
                {loadingOptions ? "Cargando proyectos…" : "Sin proyectos disponibles"}
              </option>
            ) : (
              projects.map((opt) => (
                <option key={opt.relationId} value={opt.relationId}>{opt.label}</option>
              ))
            )}
          </select>
        </div>

        <div>
          <label htmlFor="clientProject" className={labelClasses}>Proyecto Cliente</label>
          <select
            id="clientProject"
            name="clientProject"
            required
            disabled={busy || loadingOptions || clientProjects.length === 0}
            value={clientProject}
            onChange={(e) => setClientProject(e.target.value)}
            className={fieldClasses}
          >
            {clientProjects.length === 0 ? (
              <option value="">
                {loadingOptions ? "Cargando…" : "Sin opciones"}
              </option>
            ) : (
              clientProjects.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))
            )}
          </select>
        </div>

        <div>
          <label htmlFor="environment" className={labelClasses}>Ambiente</label>
          <select
            id="environment"
            name="environment"
            required
            disabled={busy}
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as TeamEnvironment)}
            className={fieldClasses}
          >
            {TEAM_ENVIRONMENTS.map((env) => (
              <option key={env} value={env}>{env}</option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelClasses}>Área</span>
          <div className="flex gap-2">
            {TEAM_SCOPES.map((area) => (
              <button
                key={area}
                type="button"
                disabled={busy}
                className={typeButtonClass(scope === area)}
                onClick={() => {
                  setScope(area);
                  setCategory(area === "Fullstack" ? "Workflows" : area);
                  setAiPrepared(false);
                }}
              >
                {area}
              </button>
            ))}
          </div>
          <input type="hidden" name="scope" value={scope} />
        </div>

        <div>
          <label htmlFor="assigneeId" className={labelClasses}>Responsable</label>
          <select
            id="assigneeId"
            name="assigneeId"
            required
            disabled={busy || loadingOptions}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className={fieldClasses}
          >
            <option value="">
              {loadingOptions ? "Cargando equipo…" : "Selecciona una persona"}
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          {!loadingOptions && users.length === 0 && (
            <p className="mt-1 text-xs text-[#b5403a]">
              No se cargaron responsables. Verifica permisos de la integración Notion.
            </p>
          )}
        </div>

        <div>
          <span className={labelClasses}>Tipo</span>
          <div className="flex gap-2">
            {TICKET_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                disabled={busy}
                className={typeButtonClass(ticketType === type)}
                onClick={() => {
                  setTicketType(type);
                  setAiPrepared(false);
                }}
              >
                {type}
              </button>
            ))}
          </div>
          <input type="hidden" name="ticketType" value={ticketType} />
        </div>

        <button
          type="button"
          disabled={busy || !rawInput.trim()}
          onClick={handlePrepare}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#2383e2] bg-[#e8f3fc] px-4 py-2.5 text-sm font-medium text-[#1a73d1] transition hover:bg-[#d6ebfa] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "structuring" && <Spinner />}
          {status === "structuring" ? "Preparando con IA…" : "Preparar con IA"}
        </button>
      </div>

      {/* --- Subtareas (opcional) --- */}
      <div className={sectionClasses}>
        <SectionTitle>Subtareas</SectionTitle>
        <p className="text-xs text-[#9b9a97]">
          Opcional. La IA sugiere subtareas en épicas; también puedes agregarlas manualmente.
        </p>

          {subtasks.length === 0 ? (
            <p className="text-sm text-[#787774]">Prepara con IA o agrega subtareas manualmente.</p>
          ) : (
            <ul className="space-y-2">
              {subtasks.map((sub, index) => (
                <li key={index} className="flex items-start gap-2 rounded-md border border-[#efefef] p-2">
                  <input
                    type="checkbox"
                    checked={sub.enabled}
                    disabled={busy}
                    onChange={(e) => updateSubtask(index, { enabled: e.target.checked })}
                    className="mt-2"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <input
                      type="text"
                      value={sub.title}
                      disabled={busy}
                      onChange={(e) => updateSubtask(index, { title: e.target.value })}
                      placeholder="Título de subtarea"
                      className={fieldClasses}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeSubtask(index)}
                    className="shrink-0 text-xs text-[#b5403a] hover:underline"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={addSubtask}
            className="text-sm text-[#2383e2] hover:underline"
          >
            + Agregar subtarea
          </button>
        </div>

      {/* --- Preview --- */}
      {(showPreview || aiPrepared) && (
        <div className={sectionClasses}>
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setShowPreview((v) => !v)}
          >
            <SectionTitle>Vista previa</SectionTitle>
            <span className="text-xs text-[#9b9a97]">{showPreview ? "Ocultar" : "Mostrar"}</span>
          </button>

          {showPreview && (
            <div className="space-y-3">
              <div>
                <label htmlFor="title" className={labelClasses}>Título</label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={busy}
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
                  className={`${fieldClasses} resize-y`}
                />
              </div>
              <div>
                <label htmlFor="bodyMarkdown" className={labelClasses}>Cuerpo (markdown)</label>
                <textarea
                  id="bodyMarkdown"
                  name="bodyMarkdown"
                  value={bodyMarkdown}
                  onChange={(e) => setBodyMarkdown(e.target.value)}
                  disabled={busy}
                  rows={6}
                  className={`${fieldClasses} resize-y font-mono text-xs`}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Avanzado --- */}
      <div className={sectionClasses}>
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <SectionTitle>Detalles avanzados</SectionTitle>
          <span className="text-xs text-[#9b9a97]">
            {showAdvanced ? "Ocultar" : "Mostrar"} (prioridad, etiquetas…)
          </span>
        </button>

        {showAdvanced && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="priority" className={labelClasses}>Prioridad</label>
                <select
                  id="priority"
                  name="priority"
                  disabled={busy}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={fieldClasses}
                >
                  {TEAM_PRIORITIES.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="category" className={labelClasses}>Categoría</label>
                <select
                  id="category"
                  name="category"
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="prLink" className={labelClasses}>Enlace PR</label>
                <input id="prLink" name="prLink" type="url" disabled={busy} className={fieldClasses} />
              </div>
              <div>
                <label htmlFor="hours" className={labelClasses}>Horas estimadas</label>
                <input
                  id="hours"
                  name="hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  disabled={busy}
                  className={fieldClasses}
                />
              </div>
            </div>

          </div>
        )}
      </div>

      {optionsError && (
        <div className="rounded-md border border-[#ffe2dd] bg-[#fdf0ef] px-3 py-2 text-sm text-[#b5403a]">
          {optionsError}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-md border border-[#ffe2dd] bg-[#fdf0ef] px-3 py-2 text-sm text-[#b5403a]">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !rawInput.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2383e2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a73d1] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" && <Spinner />}
        {status === "loading" ? "Creando en Notion…" : "Crear en Notion"}
      </button>

      {!aiPrepared && rawInput.trim() && (
        <p className="text-center text-xs text-[#9b9a97]">
          Si no preparas con IA, se estructurará automáticamente al crear.
        </p>
      )}
    </form>
  );
}
