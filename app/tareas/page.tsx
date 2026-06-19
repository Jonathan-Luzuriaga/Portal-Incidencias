import { Suspense } from "react";
import TeamTaskForm from "@/components/TeamTaskForm";

function FormFallback() {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-5 text-sm text-[#787774]">
      Cargando formulario…
    </div>
  );
}

export default function TeamTasksPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-[#37352f]">Nueva tarea</h1>
        <p className="mt-1 text-sm text-[#787774]">
          Portal interno para dev, PM y QA. Crea tareas directamente en la BD de Notion.
        </p>
      </header>
      <Suspense fallback={<FormFallback />}>
        <TeamTaskForm />
      </Suspense>
    </main>
  );
}
