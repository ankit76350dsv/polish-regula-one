import os from "node:os";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// This computer's own addresses on the local network, e.g. ["192.168.20.8"].
//
// WHY WE NEED THEM: the strict security policy below (CSP) lists the exact addresses
// the page may call. A tester on the same Wi-Fi opens SafeVoice by this computer's
// network address, so that address must be on the list or the browser blocks every
// request — even though the server would have answered.
//
// That address used to be typed into .env by hand, which broke SafeVoice for testers
// every time the router handed this machine a new one. We now ask the operating
// system for the current addresses each time the dev server starts, so it is always
// right. Only private (home/office) ranges are accepted, never a public address.
// REGULAONE_LAN_IP (set by start.sh) can name one explicitly when a machine has
// several networks.
function detectLocalNetworkIPv4s() {
  const addresses = new Set();

  // An explicitly named address is checked the same way as a detected one, so a
  // mistyped or public value can never widen the policy.
  const override = (process.env.REGULAONE_LAN_IP || "").trim();
  if (override && isLocalNetworkHost(override) && !/^127\./.test(override)) {
    addresses.add(override);
  }

  for (const interfaceAddresses of Object.values(os.networkInterfaces())) {
    for (const address of interfaceAddresses ?? []) {
      // Skip anything that is not a plain IPv4 address of this machine, and skip
      // the "only me" loopback address (127.x) — localhost is handled separately.
      if (address.family !== "IPv4" || address.internal) continue;
      if (isLocalNetworkHost(address.address) && !/^127\./.test(address.address)) {
        addresses.add(address.address);
      }
    }
  }

  return [...addresses];
}

function isLocalNetworkHost(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "::1") return true;
  if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
  const match = /^172\.(\d{1,3})\./.exec(hostname);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

// If an API is configured with a LAN IP, the runtime may rewrite that hostname
// to localhost. Both origins must therefore be present in development CSP.
function localOriginVariants(value) {
  try {
    const url = new URL(value);
    if (!isLocalNetworkHost(url.hostname)) return [];
    const port = url.port ? `:${url.port}` : "";
    return [
      `${url.protocol}//localhost${port}`,
      `${url.protocol}//127.0.0.1${port}`,
    ];
  } catch {
    return [];
  }
}

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
    connectSrc.push(
      ...localOriginVariants(regula),
      ...localOriginVariants(safe),
      ...localOriginVariants(safeWs),
    );
    // DEVELOPMENT ONLY: also allow this computer's own network addresses, so a
    // tester who opens SafeVoice at http://192.168.20.8:1003 can reach the backends
    // on that same address. ":*" means "any port on that one address" — it covers
    // the RegulaOne login API (8080), the SafeVoice API (9003) and hot reload,
    // without having to list ports that only exist while developing.
    //
    // This is never added to the production policy: the branch only runs for the
    // local dev server, and a deployed build uses real domain names instead.
    for (const address of detectLocalNetworkIPv4s()) {
      connectSrc.push(`http://${address}:*`, `ws://${address}:*`);
    }
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
      // Bind to all network interfaces (0.0.0.0) so the app is reachable BOTH on
      // http://localhost AND http://<machine-ip> (other devices on the same Wi-Fi).
      // Without this Vite listens on localhost only, so the LAN IP cannot reach it.
      // HMR host is left UNSET on purpose so Vite infers the websocket host from the
      // page (localhost→localhost, IP→IP) — hardcoding it causes reload loops.
      host: true,
      headers: {
        "Content-Security-Policy": headerCsp,
      },
    },
  };
});
