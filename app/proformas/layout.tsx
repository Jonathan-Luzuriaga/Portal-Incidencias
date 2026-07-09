import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proformas — Manticore Labs",
  description: "Estructura requerimientos y calcula proformas con tarifario Manticore",
};

export default function ProformasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
