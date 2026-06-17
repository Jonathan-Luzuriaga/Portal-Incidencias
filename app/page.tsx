import { Suspense } from "react";
import IncidentPortal from "@/components/IncidentPortal";

function FormFallback() {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-5 text-sm text-[#787774]">
      Cargando formulario…
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-[#37352f]">Reporte de incidencias</h1>
        <p className="mt-1 text-sm text-[#787774]">
          Completa el formulario. El reporte se registrará automáticamente como tarea de QA en Notion.
        </p>
      </header>
      <Suspense fallback={<FormFallback />}>
        <IncidentPortal />
      </Suspense>
    </main>
  );
}
