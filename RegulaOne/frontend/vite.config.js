import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

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
      // http://localhost:3000 AND http://192.168.20.2:3000 (other devices on the
      // same Wi-Fi). Without this Vite listens on localhost only, so the LAN IP
      // cannot reach it. HMR host is left UNSET on purpose so Vite infers the
      // websocket host from the page (localhost→localhost, IP→IP).
      host: true,
      // Let Vite serve the app when opened via the machine's LAN IP. Literal IPs
      // are usually allowed, but we list it so it never 403s as an "unknown host".
      allowedHosts: ['localhost', '192.168.20.2'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
