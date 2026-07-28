import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guía de onboarding | Manticore Labs",
  description:
    "Guía interactiva para nuevos integrantes de Manticore Labs.",
};

export default function UmbordingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
