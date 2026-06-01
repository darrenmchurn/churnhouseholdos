import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires unsafe-inline and unsafe-eval for its runtime
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https:",
              // Allow any HTTPS origin in iframes — parents control which URLs
              // are in the tile list; sites that set X-Frame-Options will still
              // block themselves regardless of this directive
              "frame-src 'self' https:",
              "font-src 'self' data:",
              "media-src 'self' https: blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
