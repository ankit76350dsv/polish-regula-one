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
      // start.sh injects PORT=3001 via "PORT=3001 npm run dev".
      port: parseInt(process.env.PORT ?? '3001', 10),
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
    },
  };
});
