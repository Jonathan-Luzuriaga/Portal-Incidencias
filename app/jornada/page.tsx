import { Suspense } from "react";
import JornadaWorkspace from "@/components/JornadaWorkspace";

export const dynamic = "force-dynamic";

function Fallback() {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-5 text-sm text-[#787774]">
      Cargando…
    </div>
  );
}

export default function JornadaPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-[#37352f]">Registro de jornada</h1>
        <p className="mt-1 text-sm text-[#787774]">
          Registra tus horas por fecha y tareas de Notion, y consulta tu total por rango
          de fechas (suma de la columna «Suma de horas»).
        </p>
      </header>
      <Suspense fallback={<Fallback />}>
        <JornadaWorkspace />
      </Suspense>
    </main>
  );
}
