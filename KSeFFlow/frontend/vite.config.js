import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

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
      // Allow the LAN IP host (Vite blocks unknown hosts by default). Literal IPs
      // are generally allowed, but we list it explicitly so it never 403s.
      allowedHosts: ['localhost', '192.168.20.63'],
      // HMR: leave the websocket host UNSET so Vite infers it from the page's host
      // (localhost → localhost ws, IP → IP ws). Hardcoding hmr.host was what caused
      // the earlier reload loop — do not reintroduce it.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
    },
  };
});
