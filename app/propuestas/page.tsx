import { Suspense } from "react";
import PropuestasWorkspace from "@/components/PropuestasWorkspace";

function FormFallback() {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-5 text-sm text-[#787774]">
      Cargando…
    </div>
  );
}

export default function PropuestasPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-[#37352f]">Propuestas</h1>
        <p className="mt-1 text-sm text-[#787774]">
          Sube una nueva propuesta o genera el PDF corporativo de una existente.
        </p>
      </header>
      <Suspense fallback={<FormFallback />}>
        <PropuestasWorkspace />
      </Suspense>
    </main>
  );
}
