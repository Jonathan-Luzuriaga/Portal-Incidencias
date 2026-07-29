import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registro de jornada — Equipo",
  description: "Registra tus horas por fecha y tareas de Notion, y consulta tu total por rango",
};

export default function JornadaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
