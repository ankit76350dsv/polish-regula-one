import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// WorkPulse frontend runs on port 3005 (see the platform start.sh port map).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3005,
  },
})
