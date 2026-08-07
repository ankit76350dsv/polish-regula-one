/**
 * RegulaOne SSO HTTP helper for PrivacyPilot.
 *
 * PrivacyPilot is the GDPR/RODO module of the RegulaOne platform. Staff sign in
 * ONCE on the central RegulaOne login page; that login sets a shared-domain,
 * httpOnly "idToken" cookie. We NEVER read or store that token in JavaScript — we
 * just send the cookie with every request (credentials: 'include'). This keeps the
 * token safe from XSS and matches exactly how SafeVoice and KSeFFlow authenticate.
 *
 * This file ONLY talks to the RegulaOne auth backend (who-am-I, silent refresh,
 * logout). PrivacyPilot's own feature data still uses the local mock transport in
 * api.js — only the LOGIN/identity is real SSO.
 */

// ── Which addresses do we call? ──────────────────────────────────────────────
// SIMPLE EXPLANATION:
// The app can be opened two ways on a developer machine: as "localhost" (on the
// machine itself) or by the machine's network address like 192.168.20.8 (a tester
// on the same Wi-Fi). Whichever way the page was opened, every service must be
// called on THAT SAME address:
//   * opened as http://localhost:3006          → backend at http://localhost:9004
//   * opened as http://192.168.20.8:3006       → backend at http://192.168.20.8:9004
// If we mixed them up, the tester's browser would try to reach a server on their
// OWN phone/laptop (which does not exist), and the shared login cookie — which the
// browser ties to the exact address that issued it — would not be sent either.
//
// So the host is taken from the page itself and only the PORT is fixed per service.
// This is the same approach KSeFFlow (src/lib/serviceHosts.js) and SafeVoice already
// use. It also means nothing needs editing when the router gives this machine a new
// address: the addresses are worked out again on every page load.
//
// A real deployment sets the VITE_* variables to proper domain names, and those
// always win over this local guessing.
const pageProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const pageHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const onPageHost = (port) => `${pageProtocol}//${pageHost}:${port}`;

// The central RegulaOne backend: who-am-I, silent refresh, logout.
const REGULAONE_API_URL = import.meta.env.VITE_REGULAONE_API_URL ?? onPageHost(8080);
// PrivacyPilot's OWN backend (the ROPA / GDPR feature API). It runs on a separate
// port from the RegulaOne auth backend (:9004 in local dev) so the two never clash.
// The shared-domain idToken cookie is sent to it with every request, and it forwards
// that cookie to RegulaOne /api/auth/me to resolve the caller and tenant.
const PRIVACYPILOT_API_URL = import.meta.env.VITE_PRIVACYPILOT_API_URL ?? onPageHost(9004);
const APP_URL = import.meta.env.VITE_APP_URL ?? onPageHost(3006);
const CENTRAL_LOGIN = import.meta.env.VITE_CENTRAL_LOGIN_URL ?? `${onPageHost(3000)}/login`;
const CENTRAL_SIGNUP = import.meta.env.VITE_CENTRAL_SIGNUP_URL ?? `${onPageHost(3000)}/signup`;

// Where the central login sends the browser back after a successful sign-in.
export const SSO_CALLBACK_URL = `${APP_URL}/auth/sso-callback`;

// ── SSO redirect-loop guard ──────────────────────────────────────────────────
// SIMPLE EXPLANATION:
// When there is no valid session we send the browser to the central login page.
// If the session cookie is not valid for the address being used (common right
// after a machine's IP changes — the old cookie was set for the old host), the
// login bounces straight back, fails again, and we loop forever. To the user this
// looks like the page "keeps reloading". So we count redirects: after a few in a
// short window we STOP and show a clear explanation instead of reloading again.
const SSO_LOOP_KEY = 'privacypilot_sso_redirect_guard';
const SSO_MAX_REDIRECTS = 3; // allowed redirects inside the window before we call it a loop
const SSO_WINDOW_MS = 30_000; // 30-second window

// Record one redirect attempt.
// Returns true  → it is safe to redirect.
// Returns false → we have redirected too many times too fast (a loop), so the
//                 caller must STOP instead of reloading the page again.
export function registerSsoRedirect() {
  const now = Date.now();

  let guard = { count: 0, first: now };
  try {
    const raw = sessionStorage.getItem(SSO_LOOP_KEY);
    if (raw) guard = JSON.parse(raw);
  } catch {
    /* ignore unreadable value */
  }

  // If the last burst was long ago, start counting fresh.
  if (now - guard.first > SSO_WINDOW_MS) guard = { count: 0, first: now };
  guard.count += 1;
  try {
    sessionStorage.setItem(SSO_LOOP_KEY, JSON.stringify(guard));
  } catch {
    /* ignore */
  }

  return guard.count <= SSO_MAX_REDIRECTS;
}

// Clear the counter once the app is proven healthy (a real authenticated call
// actually succeeded). Called after the session check confirms a valid session.
export function clearSsoRedirectGuard() {
  try {
    sessionStorage.removeItem(SSO_LOOP_KEY);
  } catch {
    /* ignore */
  }
}

// Build the central-login URL that will bring the user back to where they were.
export function buildLoginUrl() {
  const currentPath = window.location.pathname + window.location.search;
  const isGeneric =
    currentPath === '/' || currentPath === '/login' || currentPath === '/auth/sso-callback';
  const callbackUrl = isGeneric
    ? SSO_CALLBACK_URL
    : `${SSO_CALLBACK_URL}?returnPath=${encodeURIComponent(currentPath)}`;
  return `${CENTRAL_LOGIN}?redirect_uri=${encodeURIComponent(callbackUrl)}`;
}

// Send the browser to the central RegulaOne login, remembering where to come back.
export function redirectToLogin() {
  // Loop protection: if we have already bounced several times in the last few
  // seconds, redirecting again would just reload the page. Stop and let the UI
  // show an explanation (App.jsx listens for this event).
  if (!registerSsoRedirect()) {
    try {
      window.dispatchEvent(new CustomEvent('privacypilot:sso-loop'));
    } catch {
      /* ignore */
    }
    return;
  }
  window.location.href = buildLoginUrl();
}

// ── Silent token refresh ──────────────────────────────────────────────────────
// The login token only lives about an hour. Instead of bouncing the user out to
// the login page when it expires, we quietly ask the RegulaOne backend for a
// fresh one using the long-lived refreshToken cookie, then retry the request.
// Only if THAT fails is the user really logged out. Deduped so parallel 401s
// trigger just one refresh call.
let refreshInProgress = null;

export async function tryRefreshSession() {
  try {
    if (!refreshInProgress) {
      refreshInProgress = fetch(`${REGULAONE_API_URL}/api/sso/refresh`, {
        method: 'POST',
        credentials: 'include',
      }).finally(() => {
        refreshInProgress = null;
      });
    }
    const res = await refreshInProgress;
    return res.ok;
  } catch {
    // Network error while refreshing — treat as "could not refresh".
    return false;
  }
}

// Exposed for the auth service (who-am-I / logout) and the login screen.
export const REGULAONE_API_BASE = REGULAONE_API_URL;
// Exposed for the feature-data HTTP client (client.js) — the base of every
// /api/privacypilot/** call.
export const PRIVACYPILOT_API_BASE = PRIVACYPILOT_API_URL;
export const CENTRAL_LOGIN_URL = CENTRAL_LOGIN;
export const CENTRAL_SIGNUP_URL = CENTRAL_SIGNUP;
