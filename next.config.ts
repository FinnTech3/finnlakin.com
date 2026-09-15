import type { NextConfig } from "next";

/* Every page on this site is prerendered at build time, which rules out the
   usual strict-CSP approach: a per-request nonce cannot be stamped into HTML
   that was generated once, days earlier. Rather than ship a nonce that is not
   really per-request, or an enforcing policy nobody has watched pass, the
   policy below enforces the directives that genuinely protect a static
   document and is honest about the one it cannot.

   script-src allows 'unsafe-inline' because Next emits an inline bootstrap and
   the JSON-LD blocks are inline too. That is a real weakening. It is tolerable
   here specifically because the site renders no user input anywhere: there is
   no comment box, no search that echoes a query into the page, and the one
   endpoint that accepts a POST stores its input behind a closed allow-list and
   never renders it back. The directives that do the work against this site's
   actual threats, clickjacking and injected base or form targets, are enforced
   strictly. A CSP violation test loads every route and asserts the policy is
   not firing. */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  /* One origin, for the calculator embedded in the whose-inflation piece.
     Framing the real tool beats reimplementing it, which would mean inventing
     index data. frame-ancestors below still refuses to let anyone frame us. */
  "frame-src https://finntech3.github.io",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  /* Redundant alongside frame-ancestors for modern browsers, kept for older
     ones that never implemented it. */
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        /* Served from public/ at a stable, unhashed path, so it cannot be
           cached indefinitely: a change to the beacon has to reach browsers
           that already hold a copy. An hour with revalidation is the trade.
           Everything under /_next/static IS content-hashed and Next already
           marks that immutable, so this rule is only about this one file. */
        source: "/analytics.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }],
      },
      {
        /* Share cards are prerendered at build and change only on deploy, and
           the CDN is purged by the deploy itself, so it can hold them for a
           long time. The path is unhashed, so browsers still revalidate. */
        source: "/og/:card",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
