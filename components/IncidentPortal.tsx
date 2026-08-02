"use client";

import { useState } from "react";
import IncidentForm from "./IncidentForm";
import DocumentUploadForm from "./DocumentUploadForm";

type Tab = "form" | "document";

const tabs = [
  {
    id: "form" as const,
    eyebrow: "Paso a paso",
    label: "Formulario guiado",
    description: "Ideal para registrar una incidencia con todos sus detalles.",
  },
  {
    id: "document" as const,
    eyebrow: "Carga r\u00e1pida",
    label: "Subir PDF o Word",
    description: "Procesa un reporte existente y separa sus incidencias.",
  },
];

function TabIcon({ id }: { id: Tab }) {
  if (id === "document") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path d="M7 3.75h7l4 4v12.5H7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M14 3.75v4h4M12 17v-6m0 0-2.5 2.5M12 11l2.5 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 4.5h12v15H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function IncidentPortal() {
  const [tab, setTab] = useState<Tab>("form");

  return (
    <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="h-fit overflow-hidden rounded-3xl bg-[#142d56] p-4 text-white shadow-[0_24px_60px_rgba(20,45,86,0.16)] lg:sticky lg:top-6">
        <div className="border-b border-white/10 px-2 pb-4 pt-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffde62]">Elige c&oacute;mo reportar</p>
          <p className="mt-2 text-sm leading-5 text-white/65">Puedes cambiar de opci&oacute;n antes de enviar.</p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1" role="tablist" aria-label="Tipo de reporte">
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={
                  "group rounded-2xl border p-3 text-left transition duration-200 " +
                  (active
                    ? "border-[#ffce00] bg-[#1a6999] shadow-[0_12px_28px_rgba(26,105,153,0.3)]"
                    : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.08]")
                }
              >
                <span className="flex items-start gap-3">
                  <span
                    className={
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
                      (active ? "bg-white text-[#1a6999]" : "bg-white/10 text-white/75")
                    }
                  >
                    <TabIcon id={item.id} />
                  </span>
                  <span>
                    <span className={"block text-[10px] font-bold uppercase tracking-[0.14em] " + (active ? "text-white/70" : "text-[#ffde62]")}>
                      {item.eyebrow}
                    </span>
                    <span className="mt-0.5 block text-sm font-bold">{item.label}</span>
                  </span>
                </span>
                <span className="mt-3 block text-xs leading-5 text-white/65">{item.description}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-white/85">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ffce00] text-[10px] text-[#142d56]">&#10003;</span>
            Consejo para un mejor reporte
          </p>
          <p className="mt-2 text-xs leading-5 text-white/55">
            Incluye pasos claros, el resultado esperado y una captura del error.
          </p>
        </div>
      </aside>

      <div role="tabpanel" className="min-w-0">
        {tab === "form" ? <IncidentForm /> : <DocumentUploadForm />}
      </div>
    </section>
  );
}
