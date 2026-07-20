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

// Endpoints are configurable via environment variables so one build works on
// localhost and in the EEA production environment. Defaults match local dev:
// RegulaOne backend on :8080, central login on :3000, this app on :3006.
const REGULAONE_API_URL = import.meta.env.VITE_REGULAONE_API_URL ?? 'http://localhost:8080';
const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:3006';
const CENTRAL_LOGIN = import.meta.env.VITE_CENTRAL_LOGIN_URL ?? 'http://localhost:3000/login';
const CENTRAL_SIGNUP = import.meta.env.VITE_CENTRAL_SIGNUP_URL ?? 'http://localhost:3000/signup';

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
export const CENTRAL_LOGIN_URL = CENTRAL_LOGIN;
export const CENTRAL_SIGNUP_URL = CENTRAL_SIGNUP;
