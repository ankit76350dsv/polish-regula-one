# LAN IP is detected at launch — never hardcode it

**Date:** 2026-08-07
**Trigger:** the machine's Wi-Fi address changed from `192.168.20.38` to `192.168.20.8` and
testers on the office network could not use the platform. Six config files had the old
address typed into them by hand.

## The rule

**No file in this repo may contain this machine's network address.** `start.sh` detects the
current address on every launch (`detect_lan_ip`, override with `REGULAONE_LAN_IP`) and
injects it. Dev servers that need it detect it themselves via `os.networkInterfaces()`.

If you find yourself editing an IP address to make testers work, that is the bug — fix the
wiring instead.

## Where the address flows (all automatic)

| Consumer | How it gets the address |
|---|---|
| RegulaOne / KSeFFlow / SafeVoice backends | `start.sh` → `CORS_ALLOWED_ORIGINS` env → `cors.allowed-origins=${CORS_ALLOWED_ORIGINS:localhost-only}` |
| PrivacyPilot backend | `start.sh` → `PRIVACYPILOT_CORS_ORIGINS` env (property name differs, prod uses the same name) |
| WasteSync / SafeWork / WorkPulse backends (Node) | `start.sh` → `CORS_ORIGIN` env |
| Every frontend's API base URL | computed in the browser from `window.location.hostname`; only the PORT is fixed per service |
| Vite `allowedHosts` (RegulaOne, KSeFFlow) | `detectAllowedHosts()` — `os.networkInterfaces()` + `os.hostname()` |
| SafeVoice dev CSP `connect-src` | `detectLocalNetworkIPv4s()` → `http://<ip>:*` and `ws://<ip>:*`, dev server only |
| RegulaOne central-login redirect (302 on session expiry, and logout `logoutUrl`) | `SSOService.centralLoginUrlFor(request)` swaps in the host the request arrived on |

`local_frontend_origins <ports…>` in `start.sh` builds every allowlist
(`localhost` + `127.0.0.1` + LAN IP per port). RegulaOne's list covers ALL module frontend
ports because it authenticates every module.

## Two non-obvious traps that caused real breakage

1. **A pinned `.env` beats runtime host resolution.** `SafeVoice/frontend/.env` and
   `PrivacyPilot/frontend/.env` pinned `VITE_*_API_URL` to the old IP. Both `.env` files are
   now comment-only for local dev; set them ONLY for real deployments.
2. **CSP fails silently-looking.** SafeVoice's dev server sends a real CSP header built from
   those same env vars. Even with correct CORS and a correct API URL, the browser blocked
   every request because the new address was not in `connect-src`. Symptom looks like a dead
   backend, not a policy problem.

## Security boundaries kept

- No wildcard CORS origin anywhere (the shared session cookie is sent with credentials); a
  non-allowlisted origin still gets `403` on preflight — verified.
- `centralLoginUrlFor` rewrites the host **only when the configured URL AND the request host
  are both private/loopback addresses** (RFC 1918 + 127/localhost). In production the
  configured URL is a real domain, so a forged `Host` header can never redirect a signed-out
  user off-site — verified with `Host: evil.example.com`.
- LAN-IP additions to SafeVoice's CSP happen on the dev-server branch only, never in a build.

## Verified on 2026-08-07

Backend booted on a spare port with the env var; preflight from `http://192.168.20.8:3000`
allowed, from `http://192.168.20.99:3000` refused (403); `/api/sso/login` 302s to
`192.168.20.8:3000/login` for a LAN caller and to `localhost:3000/login` for a local one;
SafeVoice dev CSP contained the auto-detected `http://192.168.20.8:*`.

**Backends must be restarted (`./start.sh`) for a new address to take effect** — Vite dev
servers restart themselves on config change, Spring does not.
