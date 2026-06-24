import { Suspense } from "react";
import ProposalUploadForm from "@/components/ProposalUploadForm";

function FormFallback() {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-5 text-sm text-[#787774]">
      Cargando formulario…
    </div>
  );
}

export default function PropuestasPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-[#37352f]">Nueva propuesta</h1>
        <p className="mt-1 text-sm text-[#787774]">
          Sube el PDF o DOCX de la propuesta. Se crea en el proyecto Propuestas con responsables
          Ángeles y Cinthia; tú eliges los revisores.
        </p>
      </header>
      <Suspense fallback={<FormFallback />}>
        <ProposalUploadForm />
      </Suspense>
    </main>
  );
}
