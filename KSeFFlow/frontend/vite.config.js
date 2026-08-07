import os from 'node:os';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// The names/addresses this dev server will answer to (see `allowedHosts` below).
//
// Vite refuses a request that arrives under a host it does not know, as protection
// against a trick where a site on the internet points its own name at your computer.
// This machine's network address used to be listed here BY HAND, so the list went
// stale every time the router handed out a new one. We now ask the operating system
// for the real addresses each time the server starts, plus this computer's own name
// (macOS testers often use "Something.local"). KSEFFLOW_ALLOWED_HOSTS can add more,
// comma-separated.
function detectAllowedHosts() {
  // On a Mac os.hostname() usually already ends in ".local" (e.g. "Mini.local").
  // Add that form only when it is missing, so we never build "Mini.local.local".
  const machineName = os.hostname();
  const hosts = new Set(['localhost', machineName]);
  if (!machineName.endsWith('.local')) hosts.add(`${machineName}.local`);

  const override = (process.env.REGULAONE_LAN_IP || '').trim();
  if (override) hosts.add(override);

  for (const interfaceAddresses of Object.values(os.networkInterfaces())) {
    for (const address of interfaceAddresses ?? []) {
      // Only this machine's own real IPv4 addresses, not the loopback one.
      if (address.family === 'IPv4' && !address.internal) hosts.add(address.address);
    }
  }

  for (const extra of (process.env.KSEFFLOW_ALLOWED_HOSTS || '').split(',')) {
    const host = extra.trim();
    if (host) hosts.add(host);
  }

  return [...hosts];
}

// Mirrors the working RegulaOne frontend config. KSeFFlow only adds an explicit port (3001).
//
// IMPORTANT (why the page kept reloading): we intentionally do NOT set `server.host` or a
// custom `hmr.host`. Binding to the default (localhost) keeps Vite's hot-reload websocket on
// localhost too, so it connects cleanly. Setting host '0.0.0.0' + a custom hmr host made Vite
// resolve the websocket to the wrong address, lose the connection, and force a full page reload
// over and over. RegulaOne uses exactly this simple setup and works, so KSeFFlow matches it.
//
// Set DISABLE_HMR=true to turn hot reload off entirely if ever needed.
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Bind to all network interfaces (0.0.0.0) so the app is reachable BOTH on
      // http://localhost:3001 AND http://<machine-ip>:3001 (other devices on the
      // same Wi-Fi). RegulaOne achieves this via its Express server.ts; plain Vite
      // needs host:true or it listens on localhost only.
      host: true,
      // start.sh injects PORT=3001 via "PORT=3001 npm run dev".
      port: parseInt(process.env.PORT ?? '3001', 10),
      // Allow this machine's current network address and computer name (Vite blocks
      // unknown hosts by default). Worked out at startup, never hardcoded.
      allowedHosts: detectAllowedHosts(),
      // HMR: leave the websocket host UNSET so Vite infers it from the page's host
      // (localhost → localhost ws, IP → IP ws). Hardcoding hmr.host was what caused
      // the earlier reload loop — do not reintroduce it.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
    },
  };
});
