import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3002,
    // Bind to all network interfaces (0.0.0.0) so the app is reachable BOTH on
    // http://localhost:3002 AND http://192.168.20.38:3002 (other devices on the
    // same Wi-Fi). Without this Vite listens on localhost only, so the LAN IP
    // cannot reach it.
    host: true,
    // Let Vite serve the app when opened via the machine's LAN IP so it never
    // 403s as an "unknown host".
    allowedHosts: ['localhost', '192.168.20.38'],
  },
})
