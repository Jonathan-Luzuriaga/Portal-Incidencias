"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CreatedIncidentSummary, IncidentApiResponse } from "@/lib/types";
import { resolveClientProject } from "@/lib/project-profiles";
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
  "w-full rounded-xl border border-[#d5e3ec] bg-white px-3.5 py-3 text-sm text-[#173b59] " +
  "shadow-[0_1px_2px_rgba(65,28,51,0.03)] outline-none transition duration-200 " +
  "placeholder:text-[#8399aa] hover:border-[#9bbdd2] focus:border-[#1a6999] focus:ring-4 focus:ring-[#1a6999]/10 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const labelClasses = "mb-2 block text-sm font-semibold text-[#203d58]";

const sectionClasses =
  "space-y-5 rounded-2xl border border-[#deebf2] bg-[#fffefe] p-4 shadow-[0_10px_28px_rgba(20,45,86,0.035)] sm:p-6";

function SectionTitle({
  number,
  children,
  description,
}: {
  number: string;
  children: React.ReactNode;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[#f1e7ed] pb-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e5f0f6] text-xs font-black text-[#1a6999]">
        {number}
      </span>
      <div>
        <h3 className="text-sm font-bold text-[#142d56]">{children}</h3>
        <p className="mt-0.5 text-xs leading-5 text-[#627b8e]">{description}</p>
      </div>
    </div>
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
  const [dateTime, setDateTime] = useState(() => nowInGuayaquil());
  const [clientProject, setClientProject] = useState(() => resolveClientProject(searchParams.get("proyecto")));
  const [completion, setCompletion] = useState(25);


  const loading = status === "loading";

  function updateCompletion() {
    requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form) return;
      const required = Array.from(
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[required]")
      );
      const names = new Set(required.map((field) => field.name));
      const completed = [...names].filter((name) => required.some((field) => field.name === name && field.value.trim())).length;
      setCompletion(names.size ? Math.round((completed / names.size) * 100) : 0);
    });
  }

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
    setCompletion(25);
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
      onInput={updateCompletion}
      onChange={updateCompletion}
      className="space-y-5 rounded-3xl border border-[#d7e5ee] bg-white p-4 shadow-[0_24px_70px_rgba(20,45,86,0.1)] sm:p-6"
      noValidate
    >
      <input type="hidden" name="dateTime" value={dateTime} />

      <div className="rounded-2xl bg-[#f4f8fb] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#142d56]">Completa tu reporte</p>
            <RequiredLegend />
          </div>
          <span className="text-sm font-black tabular-nums text-[#1a6999]">{completion}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eadce5]">
          <div
            className="h-full rounded-full bg-[#1a6999] transition-[width] duration-300 ease-out"
            style={{ width: completion + "%" }}
          />
        </div>
      </div>

      {/* --- Datos generales --- */}
      <div className={sectionClasses}>
        <SectionTitle number="01" description={"Cu\u00e9ntanos qu\u00e9 ocurri\u00f3 y d\u00f3nde lo observaste."}>Datos generales</SectionTitle>

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
          <fieldset>
            <legend className={labelClasses}>Prioridad<RequiredMark /></legend>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <label key={opt.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    value={opt.value}
                    required
                    disabled={loading}
                    defaultChecked={opt.value === "Medio"}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-xl border border-[#d5e3ec] bg-white px-2 text-xs font-bold text-[#506a7d] transition hover:border-[#9bbbd0] peer-checked:border-[#1a6999] peer-checked:bg-[#e6f1f7] peer-checked:text-[#1a6999] peer-focus-visible:ring-4 peer-focus-visible:ring-[#1a6999]/10">
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
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
        <SectionTitle number="02" description={"Ay\u00fadanos a reproducir el problema en las mismas condiciones."}>Contexto y entorno</SectionTitle>

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
        <SectionTitle number="03" description="Compara el comportamiento actual con el resultado esperado.">Detalle del bug</SectionTitle>

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
        <SectionTitle number="04" description={"Las capturas aceleran la revisi\u00f3n y reducen preguntas."}>Evidencias</SectionTitle>

        <EvidenceInput disabled={loading} onChange={setEvidenceFiles} />
      </div>

      {status === "error" && (
        <div className="rounded-xl border border-[#f0c8d3] bg-[#fff4f6] px-4 py-3 text-sm text-[#a33350]">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a6999] px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_26px_rgba(26,105,153,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#13416e] hover:shadow-[0_16px_32px_rgba(26,105,153,0.3)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {loading && <Spinner />}
        {loading ? "Procesando reporte…" : "Enviar incidencia"}
      </button>
    </form>
  );
}
