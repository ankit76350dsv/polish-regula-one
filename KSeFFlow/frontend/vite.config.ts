import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // KSeFFlow runs on port 3001 per the start.sh port map.
      // start.sh injects PORT=3001 via "PORT=3001 npm run dev" so this works
      // for all modules without hardcoding a port in package.json.
      port: parseInt(process.env.PORT ?? '3001'),
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
    },
  };
});
