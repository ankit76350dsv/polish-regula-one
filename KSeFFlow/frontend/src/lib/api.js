/**
 * Central HTTP client for KSeFFlow.
 * Forwards the shared-domain idToken cookie set by the RegulaOne backend.
 *
 * Every backend endpoint returns an AppResponse<T> envelope:
 *   { success, message, data, errorCode, status }
 *
 * This module transparently unwraps it so components receive `data` on success
 * and a thrown Error (with .message and .errorCode) on failure.
 *
 * On 401: redirects to the central login page with ?redirect_uri so the user
 * lands back here after authenticating on the main app.
 */

const REGULA_ONE_API_URL        = import.meta.env.VITE_REGULA_ONE_API_URL          ?? 'http://localhost:8080';
const KSEF_API_URL  = import.meta.env.VITE_KSEF_API_URL      ?? 'http://localhost:8081';
const APP_URL       = import.meta.env.VITE_APP_URL           ?? 'http://localhost:3001';
const CENTRAL_LOGIN = import.meta.env.VITE_CENTRAL_LOGIN_URL ?? 'http://localhost:3000/login';

export const SSO_CALLBACK_URL = `${APP_URL}/auth/sso-callback`;

// ── SSO redirect-loop guard (shared) ────────────────────────────────────────────
// SIMPLE EXPLANATION:
// When there is no valid session we send the browser to the central login page.
// Two different places do this:
//   1. redirectToLogin() below — fired when ANY backend call answers 401.
//   2. the <Login /> screen — fired when there is no session at all.
//
// WHY THIS MUST BE SHARED (this is the bug that made the page "keep reloading"):
// /api/auth/me on the RegulaOne backend (:8080) can say "you are logged in" while a
// KSeFFlow call on the OTHER backend (:8081) still answers 401. That 401 triggered a
// redirect to the central login, which — because it DOES still have a session — bounced
// the browser straight back here, where the 401 happened again… an endless reload loop.
// If the two redirect places counted separately, neither could ever notice the loop.
// So both now count against ONE budget: at most a few redirects inside a short window.
const SSO_LOOP_KEY      = 'ksef_sso_redirect_guard';
const SSO_MAX_REDIRECTS = 3;        // allowed redirects inside the window before we call it a loop
const SSO_WINDOW_MS     = 30_000;   // 30-second window

// Record one redirect attempt.
// Returns true  → it is safe to redirect.
// Returns false → we have redirected too many times too fast = we are stuck in a loop,
//                 so the caller must STOP instead of reloading the page again.
export function registerSsoRedirect() {
  const now = Date.now();

  // Read how many times we have redirected recently.
  let guard = { count: 0, first: now };
  try {
    const raw = sessionStorage.getItem(SSO_LOOP_KEY);
    if (raw) guard = JSON.parse(raw);
  } catch { /* ignore unreadable value */ }

  // If the last burst was long ago, start counting fresh.
  if (now - guard.first > SSO_WINDOW_MS) guard = { count: 0, first: now };
  guard.count += 1;
  try { sessionStorage.setItem(SSO_LOOP_KEY, JSON.stringify(guard)); } catch { /* ignore */ }

  return guard.count <= SSO_MAX_REDIRECTS;
}

// Clear the counter. Call this ONLY once the app is proven healthy (a real data call
// to the KSeFFlow backend actually succeeded) — NOT just because /api/auth/me passed,
// because /me passes on every single loop turn and clearing it there hides the loop.
export function clearSsoRedirectGuard() {
  try { sessionStorage.removeItem(SSO_LOOP_KEY); } catch { /* ignore */ }
}

function redirectToLogin() {
  // Loop protection: if we have already bounced through the login redirect several
  // times in the last few seconds, the session cookie is simply not valid for this
  // host/backend. Redirecting again would just reload the page one more time. Stop,
  // and tell the app to show a clear explanation instead of reloading forever.
  if (!registerSsoRedirect()) {
    try { window.dispatchEvent(new CustomEvent('ksef:sso-loop')); } catch { /* ignore */ }
    return;
  }
  const currentPath = window.location.pathname + window.location.search;
  const isGeneric = currentPath === '/' || currentPath === '/login' || currentPath === '/auth/sso-callback';
  const callbackUrl = isGeneric
    ? SSO_CALLBACK_URL
    : `${SSO_CALLBACK_URL}?returnPath=${encodeURIComponent(currentPath)}`;

  const returnTo = encodeURIComponent(callbackUrl);
  window.location.href = `${CENTRAL_LOGIN}?redirect_uri=${returnTo}`;
}

// ── Silent token refresh ────────────────────────────────────────────────────────
// SIMPLE EXPLANATION OF THE BUG THIS FIXES:
// The login token (idToken) from AWS Cognito only lives about an hour. KSeFFlow used to
// react to the resulting 401 by IMMEDIATELY sending the browser to the central login page
// and back — which looked exactly like the page "reloading by itself" every hour or so.
// The RegulaOne app never had this problem because it quietly asks the backend for a fresh
// token first. This adds the SAME behaviour to KSeFFlow:
//   1. a request comes back 401 (token expired)
//   2. we call POST /api/sso/refresh ONCE (it uses the long-lived refreshToken cookie and
//      sets a brand-new idToken cookie)
//   3. we retry the original request — the user sees nothing
//   4. only if the refresh ALSO fails (you have been logged out for real) do we redirect.
//
// Note: refresh lives on the RegulaOne backend (API_URL, :8080), not the KSeFFlow backend.
// On localhost the idToken cookie is shared across ports, so the refreshed cookie is sent
// to the KSeFFlow backend (:8081) on the retry automatically.

// Only one refresh runs at a time; several 401s arriving together share this one promise.
let refreshInProgress = null;

export async function tryRefreshSession() {
  try {
    if (!refreshInProgress) {
      refreshInProgress = fetch(`${REGULA_ONE_API_URL }/api/sso/refresh`, {
        method: 'POST',
        credentials: 'include',
      }).finally(() => { refreshInProgress = null; });
    }
    const res = await refreshInProgress;
    return res.ok;
  } catch {
    // Network error while refreshing — treat as "could not refresh".
    return false;
  }
}

// Builds a normalised Error from any KSeFFlow backend error shape:
//   - the {success,status,errorCode,message} envelope
//   - Spring field-validation JSON ({ errors: [{ field, defaultMessage }] })
//   - a plain-string body, or an HTML/proxy error page
async function normaliseError(res) {
  const raw = await res.text().catch(() => '');
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* not JSON */ }

  let message;
  if (typeof body === 'string') {
    message = body;
  } else if (body) {
    if (Array.isArray(body.errors) && body.errors.length) {
      message = body.errors
        .map(e => e.defaultMessage || e.message || (e.field ? `${e.field} is invalid` : null))
        .filter(Boolean)
        .join('; ');
    }
    message = message || body.message || body.error;
  } else if (raw) {
    message = raw;
  }
  message = message || res.statusText || `Request failed (${res.status})`;

  const err = new Error(message);
  err.errorCode  = body?.errorCode ?? 'UNKNOWN_ERROR';
  err.httpStatus = res.status;
  return err;
}

/**
 * Hardened HTTP client for the KSeFFlow backend (VITE_KSEF_API_URL, default :8081).
 *
 * Security / compliance contract:
 *   - Authentication is the httpOnly idToken cookie ONLY (credentials:'include').
 *     The token is never read or stored by JS, so it is not exposed to XSS.
 *   - The client NEVER sends tenant or user identity (no X-Tenant-Id / X-User-Id /
 *     X-User-Email). The backend derives tenant + user from the verified session
 *     (RegulaOne /api/auth/me) — this is what enforces tenant isolation. A client-
 *     asserted tenant id would be both ignored by the backend and a security anti-pattern.
 *   - 401 → try a silent token refresh + retry first; only redirect to the central login
 *     if that refresh fails. 403 (no org / forbidden) and other errors throw a normalised
 *     Error the UI can display.
 *
 * Returns parsed JSON (or raw text for non-JSON bodies such as UPO XML), null on 204.
 *
 * @param {boolean} [_retry] internal flag — true on the single retry after a token refresh,
 *                           so we never loop refreshing forever.
 */
export async function ksefFetch(path, options = {}, _retry = false) {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`${KSEF_API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      // JSON content-type for JSON bodies; the browser sets multipart boundaries itself.
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Token probably just expired. Refresh once and retry silently before giving up.
    if (!_retry && await tryRefreshSession()) {
      return ksefFetch(path, options, true);
    }
    // Refresh failed (or already retried) — the session is genuinely gone. Now redirect.
    redirectToLogin();
    throw new Error('Session expired — redirecting to login');
  }
  if (res.status === 204) return null;
  if (!res.ok) throw await normaliseError(res);

  const text = await res.text().catch(() => '');
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export async function apiFetch(path, options = {}, _retry = false) {
  const res = await fetch(`${REGULA_ONE_API_URL }${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Same silent-refresh-then-retry strategy as ksefFetch above.
    if (!_retry && await tryRefreshSession()) {
      return apiFetch(path, options, true);
    }
    redirectToLogin();
    throw new Error('Session expired — redirecting to login');
  }

  // Parse body — safe even for 4xx/5xx
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message   = json?.message   ?? res.statusText ?? 'Request failed';
    const errorCode = json?.errorCode ?? 'UNKNOWN_ERROR';
    const err = new Error(message);
    err.errorCode  = errorCode;
    err.httpStatus = json?.status ?? res.status;
    throw err;
  }

  if (res.status === 204 || json === null) return null;

  // Unwrap AppResponse envelope
  if (json && typeof json === 'object' && 'success' in json) {
    if (!json.success) {
      const err = new Error(json.message ?? 'Request failed');
      err.errorCode  = json.errorCode;
      err.httpStatus = json.status;
      throw err;
    }
    return json.data;
  }

  return json;
}

export const api = {
  get:    (path)         => apiFetch(path),
  post:   (path, body)   => apiFetch(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:    (path, body)   => apiFetch(path, { method: 'PUT',   body: JSON.stringify(body) }),
  patch:  (path, body)   => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del:    (path)         => apiFetch(path, { method: 'DELETE' }),
};
