"use client";

import { useState } from "react";
import IncidentForm from "./IncidentForm";
import DocumentUploadForm from "./DocumentUploadForm";

type Tab = "form" | "document";

const tabClasses = (active: boolean) =>
  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition " +
  (active
    ? "bg-white text-[#37352f] shadow-sm"
    : "text-[#787774] hover:text-[#37352f]");

export default function IncidentPortal() {
  const [tab, setTab] = useState<Tab>("form");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-[#efefef] bg-[#f7f7f5] p-1">
        <button type="button" className={tabClasses(tab === "form")} onClick={() => setTab("form")}>
          Formulario
        </button>
        <button type="button" className={tabClasses(tab === "document")} onClick={() => setTab("document")}>
          Subir PDF / Word
        </button>
      </div>

      {tab === "form" ? <IncidentForm /> : <DocumentUploadForm />}
    </div>
  );
}
