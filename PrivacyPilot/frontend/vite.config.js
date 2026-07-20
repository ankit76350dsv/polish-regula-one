import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Just the "https://host:port" origin of a URL (drops any path), for use in CSP.
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Content-Security-Policy for the PRODUCTION build (CLAUDE.md §11). Injected as a
 * <meta> tag only when building — not in dev, where Vite's HMR needs inline scripts
 * and a websocket a strict policy would block. In real deployments the same policy
 * should ALSO be sent as an HTTP response header at the edge.
 *   - style 'unsafe-inline': Tailwind and Recharts emit inline style attributes.
 *   - font/img 'self' + data: self-hosted @fontsource fonts, no CDN (EU residency).
 *   - frame-ancestors/object-src 'none': clickjacking + plugin hardening.
 *   - connect-src: 'self' PLUS the RegulaOne SSO origins (the /api/auth/me,
 *     /api/sso/refresh and /api/sso/logout calls) so single sign-on works cross-origin.
 *   - form-action: 'self' PLUS the central login, since sign-in/out navigate there.
 */
function buildCsp(env) {
  const ssoOrigins = [
    originOf(env.VITE_REGULAONE_API_URL ?? 'http://localhost:8080'),
    originOf(env.VITE_CENTRAL_LOGIN_URL ?? 'http://localhost:3000/login'),
  ].filter(Boolean);
  const uniqueOrigins = [...new Set(ssoOrigins)].join(' ');

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${uniqueOrigins}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${uniqueOrigins}`.trim(),
    "frame-ancestors 'none'",
  ].join('; ');
}

/** Inject the CSP <meta> into index.html at build time only. */
function cspMetaPlugin(csp) {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${csp}" />\n  </head>`,
      );
    },
  };
}

// Vite config — mirrors the RegulaOne frontend conventions:
// the "@" alias points at the project root so imports look like
// "@/components/ui/button" and "@/src/store".
export default defineConfig(({ mode }) => {
  // Load VITE_* vars so the CSP can allow the configured RegulaOne SSO origins.
  const env = loadEnv(mode, __dirname, '');
  return {
  plugins: [react(), tailwindcss(), cspMetaPlugin(buildCsp(env))],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // Use the PORT env var when the launcher (start.sh) provides one so the
    // dev server matches the platform port map (PrivacyPilot frontend = 3006).
    // We use 3006 (not 1004) because ports below 1024 are "privileged" on
    // macOS/Linux and cannot be opened without root — trying 1004 fails with
    // "EACCES: permission denied". 3006 is free and needs no special rights.
    port: Number(process.env.PORT) || 3006,
  },
  };
});
