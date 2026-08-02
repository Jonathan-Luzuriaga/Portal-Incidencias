import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reportar incidencia — Manticore",
  description: "Portal de reporte de incidencias de Manticore",
};

export default function ManticoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
