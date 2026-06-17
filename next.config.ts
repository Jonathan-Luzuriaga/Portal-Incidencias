import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse y mammoth fallan si Next los empaqueta para serverless (Vercel).
  serverExternalPackages: ["pdf-parse", "mammoth"],
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
