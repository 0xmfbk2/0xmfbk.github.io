import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// =============================================================================
// Security headers — applied to EVERY response leaving this server, on every
// hosting target (Render, Netlify, or any future host), since this fetch
// handler is the single point all responses pass through regardless of
// platform. Kept in one place on purpose: adding headers per-route is how
// projects end up with half their pages protected and half forgotten.
// =============================================================================
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    // Only the exact dark-mode init script in __root.tsx is allow-listed, by hash —
    // no 'unsafe-inline' for scripts. Any new inline <script> needs its own hash added here.
    "script-src 'self' 'sha256-OqxHjeTJ+uiBQNZzHOLC/CbMdfxiPQALapG6hTdyCh4='",
    // Tailwind/Radix inject inline styles dynamically — cannot be hashed in advance.
    // Inline styles are a far smaller XSS surface than inline scripts, so this is
    // an accepted, deliberate trade-off rather than a blanket relaxation.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://ddwgwxqsjmdcfqrtkgjc.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
};

// Vite's dev server (HMR client scripts, fast-refresh injections, the dev
// error overlay) relies on inline/dynamically-injected scripts and styles
// that can't be hash-allowed ahead of time. The strict CSP below is only
// meaningful — and only applied — against a real production build.
//
// Using process.env.NODE_ENV here rather than import.meta.env.DEV on purpose:
// this file runs through Vite's SSR module runner in dev, where import.meta.env
// static replacement isn't guaranteed — process.env.NODE_ENV is a real runtime
// value read at execution time, not a build-time text substitution, so it's
// reliable regardless of how this module gets loaded.
const isDev = process.env.NODE_ENV !== "production";

function withSecurityHeaders(response: Response, request: Request): Response {
  if (isDev) return response;

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  // Belt-and-suspenders: keep admin routes out of search indexes even if the
  // secret slug ever leaks, on top of the route-level meta tag already in admin.tsx.
  if (new URL(request.url).pathname.startsWith("/admin")) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  // Passing response.body straight through (not re-reading it) keeps SSR
  // streaming intact — only the headers are replaced, the stream is untouched.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return withSecurityHeaders(normalized, request);
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
      );
    }
  },
};
