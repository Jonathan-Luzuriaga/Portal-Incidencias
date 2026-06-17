import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
              "frame-ancestors 'self' https://*.notion.so https://*.notion.site",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
