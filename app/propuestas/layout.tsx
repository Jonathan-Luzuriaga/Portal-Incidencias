import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nueva propuesta — Equipo",
  description: "Sube una propuesta (PDF/DOCX) y créala como tarea en Notion",
};

export default function PropuestasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
