import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reportar incidencia — Bago",
  description: "Portal de reporte de incidencias para el cliente Bago",
};

export default function BagoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
