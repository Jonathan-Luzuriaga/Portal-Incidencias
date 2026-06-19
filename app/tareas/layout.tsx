import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nueva tarea — Equipo",
  description: "Portal interno para crear tareas en Notion",
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return children;
}
