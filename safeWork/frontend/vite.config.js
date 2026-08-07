import os from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// SafeWork frontend runs on port 3002 (see the platform start.sh port map).

// Vite refuses requests that arrive under a NAME it does not know (a protection against a
// trick where a website on the internet points its own name at your computer). Plain IP
// addresses are always fine, so http://192.168.x.y:3002 works with no setup.
//
// But on a Mac network people often reach a machine by its computer name instead, like
// "Rohans-Mac-mini.local" — and that WOULD be refused with a "host is not allowed" page.
// So we add this computer's own name, and nothing else. No wildcard: a name we did not ask
// for is still turned away. SAFEWORK_ALLOWED_HOSTS can add more, comma-separated.
const allowedHosts = [
  os.hostname(),
  ...(process.env.SAFEWORK_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
]

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on every network connection, not just this computer, so http://<machine-ip>:3002
    // works and other people on the office Wi-Fi can open SafeWork. ("true" is the same as
    // "0.0.0.0" but also covers IPv6, so it is the safer spelling.)
    host: true,

    // The launcher (start.sh) sets PORT; running "npm run dev" by hand sets nothing. Both
    // paths must land on 3002, because that is this module's slot in the platform port map
    // and the backend allows that port through CORS.
    port: Number(process.env.PORT) || 3002,

    // Stay on 3002 or stop. Without this, a busy 3002 makes Vite quietly start on the next
    // free port — which belongs to another module in the port map. Two apps sharing a port
    // map is confusing, and sign-in would return the user to the wrong app.
    strictPort: true,

    // Names (not IP addresses) that may be used to open this dev server — see above.
    allowedHosts,

    // The live-reload connection is deliberately NOT pinned here. Vite works out its own
    // address from the page that is open, so localhost reloads through localhost and the
    // LAN address reloads through the LAN address. Setting it would break one of the two.
  },
})
