import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Build a strict Content-Security-Policy (CLAUDE.md §11). connect-src must allow the API and
// WebSocket origins, which are environment-specific, so we compute it from the same VITE_ vars
// the app uses. Delivered as a <meta http-equiv> injected into index.html (works on any static
// host) AND as a dev-server response header. NOTE: `frame-ancestors` is IGNORED when delivered
// via <meta> — clickjacking protection must be set as a real response header at the production
// proxy/ingress (also send HSTS there); it is included below for when the CSP is served as a header.
function buildCsp(env) {
  const regula = env.VITE_REGULAONE_API_URL || "http://localhost:8080";
  const safe = env.VITE_SAFEVOICE_API_URL || "http://localhost:9003";
  const safeWs = safe.replace(/^http/, "ws"); // http→ws, https→wss (SockJS/STOMP upgrade)

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // No inline scripts are emitted by the build, so we can keep script-src strict.
    "script-src 'self'",
    // Styles allow 'unsafe-inline' (Tailwind + JS-applied inline styles); style injection is far
    // lower risk than script injection, and this avoids breaking the UI.
    "style-src 'self' 'unsafe-inline'",
    // blob: for attachment previews/object URLs; data: for inline icons.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "frame-src 'self' blob:",
    `connect-src 'self' ${regula} ${safe} ${safeWs}`,
  ].join("; ");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const csp = buildCsp(env);

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        // Inject the CSP as a <meta http-equiv> as early as possible in <head>.
        name: "inject-csp-meta",
        transformIndexHtml(html) {
          return html.replace(
            '<meta charset="UTF-8" />',
            `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
          );
        },
      },
    ],
    // sockjs-client (used by the realtime client) references the Node-style `global`,
    // which does not exist in the browser. Map it to `globalThis` so it works at runtime.
    define: {
      global: "globalThis",
    },
    // Dev server sends the CSP as a real header too, so local dev matches production intent.
    server: {
      headers: {
        "Content-Security-Policy": csp,
      },
    },
  };
});
