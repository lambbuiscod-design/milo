import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const browserSecurityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), browsing-topics=()",
  },
  ...(
    isDevelopment
      ? []
      : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
  ),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@milo/ai", "@milo/contracts", "@milo/security"],
  // Browser tests use an isolated development cache so they can never
  // corrupt or invalidate the verified production build in `.next`.
  distDir: process.env.MILO_E2E_MODE === "true" ? ".next-e2e-dev" : ".next",
  serverExternalPackages: ["@tesseract.js-data/eng", "tesseract.js"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: browserSecurityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
          },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      ...["/account", "/admin", "/dashboard", "/mfa", "/login"].map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      })),
    ];
  },
};

export default nextConfig;
