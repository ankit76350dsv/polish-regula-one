import os from 'node:os';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// The names/addresses this dev server will answer to (see `allowedHosts` below).
//
// Vite refuses a request that arrives under a host it does not know, as protection
// against a trick where a site on the internet points its own name at your computer.
// Plain IP addresses are normally fine, but this machine's current network address
// used to be listed here BY HAND — so the list went stale every time the router
// handed out a new one. We now ask the operating system for the real addresses each
// time the server starts, plus this computer's own name (macOS testers often use
// "Something.local"). REGULAONE_ALLOWED_HOSTS can add more, comma-separated.
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

  for (const extra of (process.env.REGULAONE_ALLOWED_HOSTS || '').split(',')) {
    const host = extra.trim();
    if (host) hosts.add(host);
  }

  return [...hosts];
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Bind to all network interfaces (0.0.0.0) so the app is reachable BOTH on
      // http://localhost:3000 AND http://<machine-ip>:3000 (other devices on the
      // same Wi-Fi). Without this Vite listens on localhost only, so the LAN IP
      // cannot reach it. HMR host is left UNSET on purpose so Vite infers the
      // websocket host from the page (localhost→localhost, IP→IP).
      host: true,
      // Let Vite serve the app when opened via this machine's current network
      // address or computer name — worked out at startup, never hardcoded.
      allowedHosts: detectAllowedHosts(),
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
