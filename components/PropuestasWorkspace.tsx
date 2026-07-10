"use client";

import { useState } from "react";
import ProposalUploadForm from "@/components/ProposalUploadForm";
import ProposalWorkflowPdfGenerator from "@/components/ProposalWorkflowPdfGenerator";

type Tab = "pdf" | "upload";

const tabBase =
  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none";

export default function PropuestasWorkspace() {
  const [tab, setTab] = useState<Tab>("upload");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-[#efefef] bg-[#f7f7f5] p-1">
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={
            tabBase +
            (tab === "upload"
              ? " bg-white text-[#37352f] shadow-[0_1px_2px_rgba(15,15,15,0.06)]"
              : " text-[#787774] hover:text-[#37352f]")
          }
        >
          Subir propuesta
        </button>
        <button
          type="button"
          onClick={() => setTab("pdf")}
          className={
            tabBase +
            (tab === "pdf"
              ? " bg-white text-[#37352f] shadow-[0_1px_2px_rgba(15,15,15,0.06)]"
              : " text-[#787774] hover:text-[#37352f]")
          }
        >
          Generar PDF
        </button>
      </div>

      {tab === "upload" ? <ProposalUploadForm /> : <ProposalWorkflowPdfGenerator />}
    </div>
  );
}
