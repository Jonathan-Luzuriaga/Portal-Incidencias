import { Suspense } from "react";
import Image from "next/image";
import IncidentPortal from "@/components/IncidentPortal";

function FormFallback() {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-5 text-sm text-[#787774]">
      Cargando formulario…
    </div>
  );
}

export default function BagoPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f8fb] text-[#142d56]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_15%_15%,rgba(26,105,153,0.16),transparent_38%),radial-gradient(circle_at_85%_5%,rgba(255,206,0,0.18),transparent_32%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center rounded-2xl bg-white px-3 py-2 shadow-[0_12px_30px_rgba(20,45,86,0.1)]">
            <Image
              src="/propuestas-assets/manticorelogoazul.png"
              alt="Manticore Insane Apps"
              width={662}
              height={475}
              priority
              className="h-14 w-auto object-contain"
            />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e5ee] bg-white/85 px-3 py-1.5 text-xs font-semibold text-[#315b7b] shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[#32a56b] shadow-[0_0_0_4px_rgba(50,165,107,0.12)]" />
            Portal disponible
          </div>
        </header>

        <section className="mb-8 grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="max-w-3xl">
            <span className="mb-4 inline-flex rounded-full bg-[#e5f0f6] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#1a6999]">
              Gesti&oacute;n de calidad
            </span>
            <h1 className="text-balance text-3xl font-black tracking-[-0.04em] text-[#142d56] sm:text-5xl">
              Reporta una incidencia y ay&uacute;danos a mejorar.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-sm leading-6 text-[#506a7d] sm:text-base">
              Registra el problema paso a paso o sube un documento. Organizaremos la informaci&oacute;n para que el equipo pueda atenderla con rapidez.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/80 bg-white/75 p-3 shadow-[0_18px_50px_rgba(20,45,86,0.1)] backdrop-blur">
            {[
              ["01", "Describe"],
              ["02", "Adjunta"],
              ["03", "Env\u00eda"],
            ].map(([step, label]) => (
              <div key={step} className="rounded-xl px-2 py-3 text-center">
                <p className="text-xs font-black text-[#1a6999]">{step}</p>
                <p className="mt-1 text-xs font-semibold text-[#13416e]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <Suspense fallback={<FormFallback />}>
          <IncidentPortal />
        </Suspense>

        <footer className="mt-7 flex flex-col gap-2 border-t border-[#dce8f0] py-5 text-xs text-[#648096] sm:flex-row sm:items-center sm:justify-between">
          <p>La informaci&oacute;n se env&iacute;a de forma segura al equipo de calidad.</p>
          <p>Manticore &middot; Insane Apps</p>
        </footer>
      </div>
    </main>
  );
}
