"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CreatedIncidentSummary, IncidentApiResponse } from "@/lib/types";
import { DEFAULT_CLIENT_PROJECT, resolveClientProject } from "@/lib/project-profiles";
import { ClientProjectSelect } from "./ClientProjectSelect";
import { EvidenceInput } from "./EvidenceInput";
import { RequiredLegend, RequiredMark } from "./RequiredMark";
import { SuccessPanel } from "./SuccessPanel";

type Status = "idle" | "loading" | "success" | "error";

const PRIORITY_OPTIONS = [
  { value: "Alto", label: "Alto" },
  { value: "Medio", label: "Medio" },
  { value: "Bajo", label: "Bajo" },
] as const;

const ENVIRONMENT_OPTIONS = [
  { value: "Desarrollo", label: "Desarrollo" },
  { value: "LATEST", label: "LATEST" },
  { value: "QA", label: "QA" },
  { value: "Producción", label: "Producción" },
] as const;

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

function nowInGuayaquil(): string {
  return new Date().toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IncidentForm() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [created, setCreated] = useState<CreatedIncidentSummary[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [dateTime, setDateTime] = useState("");
  const [clientProject, setClientProject] = useState(DEFAULT_CLIENT_PROJECT);

  useEffect(() => {
    setDateTime(nowInGuayaquil());
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
      formData.set("dateTime", dateTime || nowInGuayaquil());
      for (const file of evidenceFiles) {
        formData.append("images", file);
      }

      const res = await fetch("/api/incidencias", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as IncidentApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMsg(!data.ok ? data.error : `Error ${res.status}`);
        setStatus("error");
        return;
      }

      setCreated([data]);
      setStatus("success");
    } catch {
      setErrorMsg("No se pudo enviar el reporte. Revisa tu conexión e inténtalo de nuevo.");
      setStatus("error");
    }
  }

  function resetForm() {
    formRef.current?.reset();
    setEvidenceFiles([]);
    setDateTime(nowInGuayaquil());
    setStatus("idle");
    setErrorMsg("");
    setCreated([]);
  }

  if (status === "success") {
    return (
      <SuccessPanel
        title="Incidencia registrada"
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
      <input type="hidden" name="dateTime" value={dateTime} />

      <RequiredLegend />

      {/* --- Datos generales --- */}
      <div className={sectionClasses}>
        <SectionTitle>Datos generales</SectionTitle>

        <ClientProjectSelect
          value={clientProject}
          onChange={setClientProject}
          disabled={loading}
        />

        <div>
          <label htmlFor="title" className={labelClasses}>Título<RequiredMark /></label>
          <input
            id="title"
            name="title"
            type="text"
            required
            disabled={loading}
            placeholder="Ej. ZONALES Latest – error en barra búsqueda"
            className={fieldClasses}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="priority" className={labelClasses}>Prioridad<RequiredMark /></label>
            <select id="priority" name="priority" required disabled={loading} className={fieldClasses} defaultValue="Medio">
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="environment" className={labelClasses}>Ambiente<RequiredMark /></label>
            <select id="environment" name="environment" required disabled={loading} className={fieldClasses} defaultValue="LATEST">
              {ENVIRONMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="justification" className={labelClasses}>Justificación / descripción<RequiredMark /></label>
          <textarea
            id="justification"
            name="justification"
            required
            disabled={loading}
            rows={2}
            placeholder="Ej. Barra de búsqueda no funciona correctamente"
            className={`${fieldClasses} resize-y`}
          />
        </div>

        <div>
          <label htmlFor="summary" className={labelClasses}>Resumen<RequiredMark /></label>
          <input
            id="summary"
            name="summary"
            type="text"
            required
            disabled={loading}
            placeholder="Ej. ZONALES Latest - error en barra de búsqueda"
            className={fieldClasses}
          />
        </div>
      </div>

      {/* --- Contexto y entorno --- */}
      <div className={sectionClasses}>
        <SectionTitle>Contexto y entorno</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="userRole" className={labelClasses}>Usuario / rol<RequiredMark /></label>
            <input
              id="userRole"
              name="userRole"
              type="text"
              required
              disabled={loading}
              placeholder="Ej. Servicios_qa / QA"
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Fecha / hora</label>
            <input
              type="text"
              readOnly
              value={dateTime}
              className={`${fieldClasses} bg-[#f7f7f5] text-[#787774]`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="moduleUrl" className={labelClasses}>Módulo / URL<RequiredMark /></label>
          <input
            id="moduleUrl"
            name="moduleUrl"
            type="text"
            required
            disabled={loading}
            placeholder="Ej. PRODUCTO / https://app.ejemplo.com/#/modulo/ruta"
            className={fieldClasses}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="browserDevice" className={labelClasses}>Navegador / dispositivo<RequiredMark /></label>
            <input
              id="browserDevice"
              name="browserDevice"
              type="text"
              required
              disabled={loading}
              placeholder="Ej. Chrome / Laptop"
              className={fieldClasses}
            />
          </div>
          <div>
            <label htmlFor="affectedRecordId" className={labelClasses}>ID / registro afectado<RequiredMark /></label>
            <input
              id="affectedRecordId"
              name="affectedRecordId"
              type="text"
              required
              disabled={loading}
              placeholder="Ej. ZONALES Latest / Gestión de Posiciones"
              className={fieldClasses}
            />
          </div>
        </div>
      </div>

      {/* --- Detalle del bug --- */}
      <div className={sectionClasses}>
        <SectionTitle>Detalle del bug</SectionTitle>

        <div>
          <label htmlFor="actualResult" className={labelClasses}>Resultado actual (pasos)<RequiredMark /></label>
          <textarea
            id="actualResult"
            name="actualResult"
            required
            disabled={loading}
            rows={5}
            placeholder={"1. Ingresar al sistema\n2. Navegar al módulo\n3. Realizar la acción\n4. Observar el error"}
            className={`${fieldClasses} resize-y`}
          />
        </div>

        <div>
          <label htmlFor="expectedResult" className={labelClasses}>Resultado esperado<RequiredMark /></label>
          <textarea
            id="expectedResult"
            name="expectedResult"
            required
            disabled={loading}
            rows={2}
            placeholder="Ej. El sistema debería volver a cargar todos los registros"
            className={`${fieldClasses} resize-y`}
          />
        </div>
      </div>

      {/* --- Evidencias --- */}
      <div className={sectionClasses}>
        <SectionTitle>Evidencias</SectionTitle>

        <EvidenceInput disabled={loading} onChange={setEvidenceFiles} />
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
        {loading ? "Procesando reporte…" : "Enviar incidencia"}
      </button>
    </form>
  );
}
