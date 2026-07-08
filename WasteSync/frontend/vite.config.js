import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The WasteSync frontend runs on port 3003 so it does not clash with the other
// RegulaOne apps (RegulaOne 3000, SafeWork 3002, etc.).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3003,
  },
})
