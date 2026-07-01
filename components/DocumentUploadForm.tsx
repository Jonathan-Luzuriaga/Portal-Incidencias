"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CreatedIncidentSummary, IncidentApiResponse } from "@/lib/types";
import { DEFAULT_CLIENT_PROJECT, resolveClientProject } from "@/lib/project-profiles";
import { ClientProjectSelect } from "./ClientProjectSelect";
import { RequiredLegend, RequiredMark } from "./RequiredMark";
import { SuccessPanel } from "./SuccessPanel";

type Status = "idle" | "loading" | "success" | "error";

const fieldClasses =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] " +
  "shadow-[0_1px_2px_rgba(15,15,15,0.04)] outline-none transition " +
  "placeholder:text-[#9b9a97] focus:border-[#b9b9b7] focus:ring-2 focus:ring-[#2383e2]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function DocumentUploadForm() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [created, setCreated] = useState<CreatedIncidentSummary[]>([]);
  const [docName, setDocName] = useState("");
  const [clientProject, setClientProject] = useState(DEFAULT_CLIENT_PROJECT);

  useEffect(() => {
    setClientProject(resolveClientProject(searchParams.get("proyecto")));
  }, [searchParams]);

  const loading = status === "loading";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setStatus("loading");
    setErrorMsg("");
    setCreated([]);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("clientProject", clientProject);

      const res = await fetch("/api/incidencias/documento", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as IncidentApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMsg(!data.ok ? data.error : `Error ${res.status}`);
        setStatus("error");
        return;
      }

      setCreated(data.created ?? [data]);
      setStatus("success");
    } catch {
      setErrorMsg("No se pudo procesar el documento. Revisa tu conexión e inténtalo de nuevo.");
      setStatus("error");
    }
  }

  function resetForm() {
    formRef.current?.reset();
    setDocName("");
    setStatus("idle");
    setErrorMsg("");
    setCreated([]);
  }

  if (status === "success") {
    const subCount = created[0]?.subtasks?.length ?? 0;
    return (
      <SuccessPanel
        title={
          subCount > 1
            ? `Ticket creado con ${subCount} incidencias`
            : subCount === 1
              ? "Ticket creado con 1 incidencia"
              : "Ticket registrado"
        }
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
    >
      <RequiredLegend />

      <ClientProjectSelect
        id="clientProjectDoc"
        value={clientProject}
        onChange={setClientProject}
        disabled={loading}
        hint="Se usa si el documento no indica claramente el proyecto."
      />

      <div>
        <label htmlFor="document" className={labelClasses}>Reporte (PDF o DOCX)<RequiredMark /></label>
        <input
          id="document"
          name="document"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          disabled={loading}
          onChange={(e) => setDocName(e.target.files?.[0]?.name ?? "")}
          className="block w-full text-sm text-[#787774] file:mr-3 file:rounded-md file:border file:border-[#efefef] file:bg-[#f7f7f5] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#37352f] hover:file:bg-[#efefef] disabled:opacity-60"
        />
        {docName && <p className="mt-1 text-xs text-[#787774]">• {docName}</p>}
        <p className="mt-2 text-xs text-[#9b9a97]">
          Las capturas incluidas en el documento se asignan a cada incidencia según la sección INCIDENCIA 001, 002…
        </p>
      </div>

      {status === "error" && (
        <div className="rounded-md border border-[#ffe2dd] bg-[#fdf0ef] px-3 py-2 text-sm text-[#b5403a]">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2383e2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a73d1] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading && <Spinner />}
        {loading ? "Leyendo documento y creando tareas…" : "Procesar documento"}
      </button>
    </form>
  );
}
