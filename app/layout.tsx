import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { IosEmbedHint } from "@/components/IosEmbedHint";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reportar incidencia",
  description: "Portal de reporte de incidencias",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} antialiased`}
      style={{ backgroundColor: "#ffffff", colorScheme: "light" }}
    >
      <body className="min-h-screen bg-white" style={{ backgroundColor: "#ffffff" }}>
        <IosEmbedHint />
        {children}
      </body>
    </html>
  );
}
