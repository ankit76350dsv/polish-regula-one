import os from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// WorkPulse frontend runs on port 3005 (see the platform start.sh port map).

// Vite refuses requests that arrive under a NAME it does not know (a protection against a
// trick where a website on the internet points its own name at your computer). Plain IP
// addresses are always fine, so http://192.168.x.y:3005 works with no setup.
//
// But on a Mac network people often reach a machine by its computer name instead, like
// "Rohans-Mac-mini.local" — and that WOULD be refused with a "host is not allowed" page.
// So we add this computer's own name, and nothing else. No wildcard: a name we did not ask
// for is still turned away. WORKPULSE_ALLOWED_HOSTS can add more, comma-separated.
const allowedHosts = [
  os.hostname(),
  ...(process.env.WORKPULSE_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
]

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on every network connection, not just this computer. Without this Vite answers
    // only on "localhost", so http://<machine-ip>:3005 shows nothing and nobody else on the
    // office Wi-Fi can open WorkPulse.
    host: true,

    // The launcher (start.sh) sets PORT; running "npm run dev" by hand sets nothing. Both
    // paths must land on 3005, because that is this module's slot in the platform port map
    // and the backend allows that port through CORS.
    port: Number(process.env.PORT) || 3005,

    // Stay on 3005 or stop. Without this, a busy 3005 makes Vite quietly start on 3006
    // instead — which is PrivacyPilot's port. Two apps on one port map is confusing, and
    // sign-in would return the user to the wrong app. Failing loudly is easier to fix.
    strictPort: true,

    // Names (not IP addresses) that may be used to open this dev server — see above.
    allowedHosts,

    // The live-reload connection is deliberately NOT pinned here. Vite works out its own
    // address from the page that is open, so localhost reloads through localhost and the
    // LAN address reloads through the LAN address. Setting it would break one of the two.
  },
})
