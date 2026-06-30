import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // sockjs-client (used by the realtime client) references the Node-style `global`,
  // which does not exist in the browser. Map it to `globalThis` so it works at runtime.
  define: {
    global: "globalThis",
  },
});
