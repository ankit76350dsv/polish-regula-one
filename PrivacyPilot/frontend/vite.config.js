import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Content-Security-Policy for the PRODUCTION build (CLAUDE.md §11). We inject it
// as a <meta> tag only when building — not in dev, where Vite's HMR needs inline
// scripts and a websocket that a strict policy would block. In real deployments
// the same policy should ALSO be sent as an HTTP response header at the edge.
//   - default/script/connect 'self': everything is same-origin (bundled JS, and
//     later the same-origin API); no third-party scripts or beacons.
//   - style 'unsafe-inline': Tailwind and Recharts emit inline style attributes.
//   - font/img 'self' + data: self-hosted @fontsource fonts, no CDN (EU residency).
//   - frame-ancestors/object-src 'none': clickjacking + plugin hardening.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Inject the CSP <meta> into index.html at build time only. */
function cspMetaPlugin() {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`,
      );
    },
  };
}

// Vite config — mirrors the RegulaOne frontend conventions:
// the "@" alias points at the project root so imports look like
// "@/components/ui/button" and "@/src/store".
export default defineConfig({
  plugins: [react(), tailwindcss(), cspMetaPlugin()],
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
});
