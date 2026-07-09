import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "unpdf",
    "mammoth",
    "jszip",
    "pngjs",
    "puppeteer-core",
    "@sparticuz/chromium-min",
  ],
  // Fuerza la inclusión de los assets de la plantilla corporativa en la función
  // serverless que genera el PDF (se leen vía fs y se incrustan como base64).
  outputFileTracingIncludes: {
    "/api/propuestas/pdf": ["./public/propuestas-assets/**"],
    "/api/proformas/pdf": ["./public/propuestas-assets/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Permite que la página se embeba dentro de Notion (bloque /embed).
          // frame-ancestors restringe quién puede meterla en un iframe.
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://app.notion.com https://notion.so https://www.notion.so https://*.notion.so https://*.notion.site",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
