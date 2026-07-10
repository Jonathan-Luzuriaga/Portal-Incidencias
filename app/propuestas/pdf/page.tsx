import type { Metadata } from "next";
import { Suspense } from "react";
import ProposalWorkflowPdfGenerator from "@/components/ProposalWorkflowPdfGenerator";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PDF de propuesta — Workflow",
  description: "Genera la vista previa y descarga el PDF corporativo desde una tarea de Notion",
};

function LoadingFallback() {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-5 text-sm text-[#787774]">
      Cargando…
    </div>
  );
}

export default function PropuestasPdfPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-[#37352f]">PDF de propuesta</h1>
        <p className="mt-1 text-sm text-[#787774]">
          Selecciona una tarea de Notion con categoría Propuesta. El sistema lee el contenido
          literal, lo coloca sobre la plantilla corporativa y te muestra la vista previa antes
          de descargar. También disponible en la pestaña Generar PDF de /propuestas.
        </p>
      </header>
      <Suspense fallback={<LoadingFallback />}>
        <ProposalWorkflowPdfGenerator />
      </Suspense>
    </main>
  );
}
