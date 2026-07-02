import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Build a strict Content-Security-Policy (CLAUDE.md §11). connect-src must allow the API and
// WebSocket origins, which are environment-specific, so we compute it from the same VITE_ vars
// the app uses. The meta policy intentionally omits `frame-ancestors`, because browsers ignore
// that directive when delivered by <meta>; clickjacking protection must be sent as a real header.
function buildCsp(
  env,
  {
    includeFrameAncestors = true,
    allowDevInlineScripts = false,
    includeViteDevWebSocket = false,
  } = {},
) {
  const regula = env.VITE_REGULAONE_API_URL || "http://localhost:8080";
  const safe = env.VITE_SAFEVOICE_API_URL || "http://localhost:9003";
  const safeWs = safe.replace(/^http/, "ws"); // http→ws, https→wss (SockJS/STOMP upgrade)
  const scriptSrc = allowDevInlineScripts
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self'";
  const connectSrc = ["connect-src 'self'", regula, safe, safeWs];

  if (includeViteDevWebSocket) {
    // Vite HMR may use the configured port or a temporary override while debugging.
    connectSrc.push(
      "ws://localhost:*",
      "ws://127.0.0.1:*",
      "ws://0.0.0.0:*",
    );
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(includeFrameAncestors ? ["frame-ancestors 'none'"] : []),
    "form-action 'self'",
    // Production emits no inline scripts. Vite dev injects the React Fast Refresh preamble inline,
    // so local `vite --serve` gets a dev-only exception without weakening production CSP.
    scriptSrc,
    // Styles allow 'unsafe-inline' (Tailwind + JS-applied inline styles); style injection is far
    // lower risk than script injection, and this avoids breaking the UI.
    "style-src 'self' 'unsafe-inline'",
    // blob: for attachment previews/object URLs; data: for inline icons.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "frame-src 'self' blob:",
    connectSrc.join(" "),
  ].join("; ");
}

export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isDevServer = command === "serve" && !isPreview;
  const metaCsp = buildCsp(env, {
    includeFrameAncestors: false,
    allowDevInlineScripts: isDevServer,
    includeViteDevWebSocket: isDevServer,
  });
  const headerCsp = buildCsp(env, {
    includeFrameAncestors: true,
    allowDevInlineScripts: isDevServer,
    includeViteDevWebSocket: isDevServer,
  });

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
            `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${metaCsp}" />`,
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
        "Content-Security-Policy": headerCsp,
      },
    },
  };
});
