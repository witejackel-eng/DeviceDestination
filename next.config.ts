import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy.
 *
 * Production hardening:
 *   - No `unsafe-eval` (dev only).
 *   - `script-src-attr 'none'` — blocks inline event handlers.
 *   - Explicit Razorpay origins (no wildcard third-party domains).
 *   - Analytics origins only when NEXT_PUBLIC_ANALYTICS_ID is set.
 *   - CSP violation reporting to /api/csp-report.
 *
 * `unsafe-inline` is retained for script-src because removing it requires
 * nonce-based CSP (middleware generates a per-request nonce, injects it into
 * both the CSP header and the HTML). This is the next hardening step; for
 * now, a Report-Only CSP is also emitted so violations can be observed
 * before enforcement.
 */
const razorpayScriptOrigins = [
  "https://checkout.razorpay.com",
  "https://api.razorpay.com",
];
const razorpayConnectOrigins = [
  "https://api.razorpay.com",
  "https://lumberjack.razorpay.com",
];
const analyticsOrigins = process.env.NEXT_PUBLIC_ANALYTICS_ID
  ? ["https://va.vercel-scripts.com", "https://vercel.live"]
  : [];

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${[...razorpayScriptOrigins, ...analyticsOrigins].join(" ")}`.trim(),
  // Block inline event handlers (onclick="...", onload="...", etc.).
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${razorpayScriptOrigins.join(" ")}`,
  "font-src 'self' data:",
  `connect-src 'self' ${[...razorpayConnectOrigins, ...analyticsOrigins, "https://*.upstash.io"].join(" ")}`,
  `frame-src ${razorpayScriptOrigins.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
  // Report violations to our endpoint for monitoring.
  "report-uri /api/csp-report",
  "report-to csp-endpoint",
].join("; ");

/**
 * Report-Only CSP — same as the enforced CSP but only reports violations
 * without blocking them. This lets us observe what would break before we
 * tighten the enforced policy further (e.g. before removing unsafe-inline).
 */
const reportOnlyCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${[...razorpayScriptOrigins, ...analyticsOrigins].join(" ")}`.trim(),
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${razorpayScriptOrigins.join(" ")}`,
  "font-src 'self' data:",
  `connect-src 'self' ${[...razorpayConnectOrigins, ...analyticsOrigins, "https://*.upstash.io"].join(" ")}`,
  `frame-src ${razorpayScriptOrigins.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
  "report-uri /api/csp-report",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // Report-Only header for gradual tightening observation.
          ...(isDev ? [] : [{ key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp }]),
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Reporting API endpoint group for CSP violation reports.
          {
            key: "Reporting-Endpoints",
            value: 'csp-endpoint="/api/csp-report"',
          },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
