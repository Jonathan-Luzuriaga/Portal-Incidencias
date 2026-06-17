import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "mammoth"],
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
