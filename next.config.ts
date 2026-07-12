import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

// 'unsafe-eval' is only required for React Fast Refresh in development —
// never ship it in a production CSP.
const scriptSrc = isProduction
  ? "'self' 'unsafe-inline'"
  : "'self' 'unsafe-inline' 'unsafe-eval'";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // The browser never talks to Meilisearch/Loki directly — both are only
  // ever called server-side from route handlers — so connect-src stays
  // scoped to same-origin API calls.
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Emits a minimal, self-contained server bundle (.next/standalone) that
  // only includes the production dependencies actually reachable from the
  // build's dependency trace. Required for the lean multi-stage Dockerfile.
  output: 'standalone',
  // pdfmake's PDF generation depends on pdfkit, which loads its bundled
  // standard-14 font metrics (.afm files) via an __dirname-relative
  // fs.readFileSync at runtime. Bundling it into the route handler's
  // Turbopack/webpack chunk breaks that relative path (ENOENT on the
  // .afm file); keeping it external means Next.js require()s it straight
  // from node_modules instead, and file-tracing for `output: standalone`
  // still picks up its on-disk assets correctly.
  serverExternalPackages: ['pdfmake', 'pdfkit'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          ...(isProduction
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
