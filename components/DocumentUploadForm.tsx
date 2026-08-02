"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CreatedIncidentSummary, IncidentApiResponse } from "@/lib/types";
import { resolveClientProject } from "@/lib/project-profiles";
import { ClientProjectSelect } from "./ClientProjectSelect";
import { DocumentDropInput } from "./DocumentDropInput";
import { RequiredLegend } from "./RequiredMark";
import { SuccessPanel } from "./SuccessPanel";

type Status = "idle" | "loading" | "success" | "error";

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
  const [clientProject, setClientProject] = useState(() => resolveClientProject(searchParams.get("proyecto")));


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
      className="space-y-5 rounded-3xl border border-[#d7e5ee] bg-white p-4 shadow-[0_24px_70px_rgba(20,45,86,0.1)] sm:p-6"
    >
      <div className="rounded-2xl bg-[#f4f8fb] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dcecf5] text-[#1a6999]">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M7 3.75h7l4 4v12.5H7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M14 3.75v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-bold text-[#142d56]">Convierte tu documento en incidencias</p>
            <p className="mt-1 text-xs leading-5 text-[#627b8e]">Acepta PDF o DOCX de hasta 15 MB. El sistema identifica y organiza cada incidencia.</p>
            <RequiredLegend />
          </div>
        </div>
      </div>

      <ClientProjectSelect
        id="clientProjectDoc"
        value={clientProject}
        onChange={setClientProject}
        disabled={loading}
        hint="Se usa si el documento no indica claramente el proyecto."
      />

      <div>
        <DocumentDropInput
          id="document"
          name="document"
          label="Reporte (PDF o DOCX)"
          hint="Arrastra el archivo aqui o haz clic para seleccionarlo."
          disabled={loading}
          onFileChange={(file) => setDocName(file?.name ?? "")}
        />
        {docName && <p className="mt-1 text-xs text-[#787774]">• {docName}</p>}
        <p className="mt-2 text-xs text-[#9b9a97]">
          Las capturas incluidas en el documento se asignan a cada incidencia según la sección INCIDENCIA 001, 002…
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {["Lee el contenido", "Separa incidencias", "Crea los tickets"].map((label, index) => (
          <div key={label} className="rounded-xl border border-[#deebf2] bg-[#f8fbfd] px-3 py-3">
            <span className="text-[10px] font-black text-[#1a6999]">0{index + 1}</span>
            <p className="mt-1 text-xs font-semibold text-[#315b7b]">{label}</p>
          </div>
        ))}
      </div>

      {status === "error" && (
        <div className="rounded-xl border border-[#f0c8d3] bg-[#fff4f6] px-4 py-3 text-sm text-[#a33350]">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a6999] px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_26px_rgba(26,105,153,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#13416e] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {loading && <Spinner />}
        {loading ? "Leyendo documento y creando tareas…" : "Procesar documento"}
      </button>
    </form>
  );
}
