/**
 * Central HTTP client for SafeVoice.
 *
 * SafeVoice is the Whistleblower module of the RegulaOne platform. Staff sign in
 * once on the central RegulaOne login page; that login sets a shared-domain,
 * httpOnly "idToken" cookie. We NEVER read or store that token in JavaScript —
 * we just send the cookie along with every request (credentials: 'include').
 * This keeps the token safe from XSS and matches how KSeFFlow authenticates.
 *
 * Every RegulaOne backend endpoint returns an AppResponse<T> envelope:
 *   { success, message, data, errorCode, status }
 * This module unwraps it so callers get `data` on success and a thrown Error
 * (with .message / .errorCode) on failure.
 *
 * On 401 (token expired or missing): we try ONE silent token refresh and retry.
 * Only if that fails do we send the browser to the central login page with a
 * ?redirect_uri that brings the user back here afterwards.
 */
// All endpoints are configurable through environment variables so the same build
// works on localhost and in the EEA production environment. Defaults match the
// local dev setup (RegulaOne backend on :8080, SafeVoice frontend on :1003).
const REGULAONE_API_URL = import.meta.env.VITE_REGULAONE_API_URL ?? "http://localhost:8080";

// The SafeVoice backend serves the whistleblower feature endpoints (/api/safevoice/…).
// In local development it runs on its OWN port (9003), separate from the central
// RegulaOne backend (8080) which only handles login/SSO. In production both sit behind
// the same gateway, so this just points at the same origin there.
const SAFEVOICE_API_URL = import.meta.env.VITE_SAFEVOICE_API_URL ?? "http://localhost:9003";
const APP_URL = import.meta.env.VITE_APP_URL ?? "http://localhost:1003";
const CENTRAL_LOGIN = import.meta.env.VITE_CENTRAL_LOGIN_URL ?? "http://localhost:3000/login";
// The central RegulaOne "create an organisation account" page. SafeVoice has no
// sign-up form of its own, so the landing page's "Sign Up" button just sends the
// visitor here. Defaults to /auth/signup on the same host as the central login.
const CENTRAL_SIGNUP =
  import.meta.env.VITE_CENTRAL_SIGNUP_URL ?? new URL("/auth/signup", CENTRAL_LOGIN).toString();

// Where the central login sends the browser back to after a successful sign-in.
export const SSO_CALLBACK_URL = `${APP_URL}/auth/sso-callback`;

// ── SSO redirect-loop guard ──────────────────────────────────────────────────
// SIMPLE EXPLANATION:
// When there is no valid session we send the browser to the central login page.
// If the session cookie is not valid for the address being used (common right
// after a machine's IP changes — the old cookie was set for the old host), the
// login bounces straight back, fails again, and we loop forever. To the user this
// looks like the page "keeps reloading". So we count redirects: after a few in a
// short window we STOP and show a clear explanation instead of reloading again.
const SSO_LOOP_KEY = "safevoice_sso_redirect_guard";
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

// Send the browser to the central RegulaOne login, remembering where to come back.
export function redirectToLogin() {
  // Loop protection: if we have already bounced several times in the last few
  // seconds, redirecting again would just reload the page. Stop and let the UI
  // show an explanation (the authSlice listens for this event).
  if (!registerSsoRedirect()) {
    try {
      window.dispatchEvent(new CustomEvent("safevoice:sso-loop"));
    } catch {
      /* ignore */
    }
    return;
  }

  const currentPath = window.location.pathname + window.location.search;
  const isGeneric =
    currentPath === "/" || currentPath === "/login" || currentPath === "/auth/sso-callback";
  const callbackUrl = isGeneric
    ? SSO_CALLBACK_URL
    : `${SSO_CALLBACK_URL}?returnPath=${encodeURIComponent(currentPath)}`;

  const returnTo = encodeURIComponent(callbackUrl);
  window.location.href = `${CENTRAL_LOGIN}?redirect_uri=${returnTo}`;
}

// ── Silent token refresh ──────────────────────────────────────────────────────
// The login token only lives about an hour. Instead of bouncing the user out to
// the login page when it expires, we quietly ask the RegulaOne backend for a
// fresh one using the long-lived refreshToken cookie, then retry the request.
// Only if THAT fails is the user really logged out.
let refreshInProgress = null;

export async function tryRefreshSession() {
  try {
    if (!refreshInProgress) {
      refreshInProgress = fetch(`${REGULAONE_API_URL}/api/sso/refresh`, {
        method: "POST",
        credentials: "include",
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

// Build a readable Error from any RegulaOne backend error shape (envelope,
// Spring field-validation list, plain string, or an HTML/proxy error page).
async function normaliseError(res) {
  const raw = await res.text().catch(() => "");
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    /* not JSON */
  }

  let message;
  if (typeof body === "string") {
    message = body;
  } else if (body) {
    if (Array.isArray(body.errors) && body.errors.length) {
      message = body.errors
        .map((e) => e.defaultMessage || e.message || (e.field ? `${e.field} is invalid` : null))
        .filter(Boolean)
        .join("; ");
    }
    message = message || body.message || body.error;
  } else if (raw) {
    message = raw;
  }
  message = message || res.statusText || `Request failed (${res.status})`;

  const err = new Error(message);
  err.errorCode = body?.errorCode ?? "UNKNOWN_ERROR";
  err.httpStatus = res.status;
  return err;
}

/**
 * Hardened HTTP client for the RegulaOne backend.
 *
 * Security / compliance contract (matches KSeFFlow):
 *   - Auth is the httpOnly idToken cookie ONLY (credentials:'include'). The token
 *     is never read or stored by JS, so it is not exposed to XSS.
 *   - The client NEVER sends tenant or user identity. The backend derives them
 *     from the verified session — this is what enforces tenant isolation.
 *   - 401 → try a silent refresh + retry once; only redirect to the central login
 *     if that fails. Other errors throw a normalised Error the UI can show.
 *
 * @param {string}  path     backend path beginning with "/"
 * @param {object}  options  fetch options. Two SafeVoice-specific extras:
 *                           - baseUrl:  which backend to call (defaults to the
 *                             RegulaOne auth backend). Public SafeVoice calls pass
 *                             the SafeVoice backend base instead.
 *                           - isPublic: true for anonymous whistleblower endpoints.
 *                             The reporter has NO account, so a 401 must NOT bounce
 *                             them to the staff login — we just surface the error.
 * @param {boolean} [_retry] internal flag — true on the single post-refresh retry
 *                           so we never loop refreshing forever.
 */
export async function apiFetch(path, options = {}, _retry = false) {
  // Pull our two custom flags out so they are never forwarded to fetch() as if they
  // were real request options. Everything else passes straight through to fetch.
  const { baseUrl = REGULAONE_API_URL, isPublic = false, ...fetchOptions } = options;

  // When the body is FormData (a multipart upload) we must NOT set Content-Type ourselves —
  // the browser adds it WITH the multipart boundary. For everything else we send JSON.
  const isForm = fetchOptions.body instanceof FormData;

  const res = await fetch(`${baseUrl}${path}`, {
    ...fetchOptions,
    credentials: "include",
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...fetchOptions.headers,
    },
  });

  if (res.status === 401) {
    // Anonymous reporter pages have no session to refresh and no login to go to,
    // so we never redirect them — the caller handles the error message instead.
    if (isPublic) {
      throw await normaliseError(res);
    }
    if (!_retry && (await tryRefreshSession())) {
      return apiFetch(path, options, true);
    }
    redirectToLogin();
    throw new Error("Session expired — redirecting to login");
  }

  // Parse body — safe even for 4xx/5xx.
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message = json?.message ?? res.statusText ?? "Request failed";
    const err = new Error(message);
    err.errorCode = json?.errorCode ?? "UNKNOWN_ERROR";
    err.httpStatus = json?.status ?? res.status;
    throw err;
  }

  if (res.status === 204 || json === null) return null;

  // Unwrap the AppResponse envelope when present.
  if (json && typeof json === "object" && "success" in json) {
    if (!json.success) {
      const err = new Error(json.message ?? "Request failed");
      err.errorCode = json.errorCode;
      err.httpStatus = json.status;
      throw err;
    }
    return json.data;
  }

  return json;
}

/**
 * Fetch a BINARY file (e.g. an evidence attachment) with the same auth behaviour as apiFetch:
 * cookie auth, and — for staff — one silent refresh on 401 before giving up. Returns
 * { blob, filename }, reading the server-suggested name from Content-Disposition when present.
 */
export async function downloadFile(path, options = {}, _retry = false) {
  const { baseUrl = SAFEVOICE_API_URL, isPublic = false, ...fetchOptions } = options;
  const isForm = fetchOptions.body instanceof FormData;

  const res = await fetch(`${baseUrl}${path}`, {
    ...fetchOptions,
    credentials: "include",
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...fetchOptions.headers,
    },
  });

  if (res.status === 401) {
    if (isPublic) throw await normaliseError(res);
    if (!_retry && (await tryRefreshSession())) return downloadFile(path, options, true);
    redirectToLogin();
    throw new Error("Session expired — redirecting to login");
  }
  if (!res.ok) throw await normaliseError(res);

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return { blob, filename: match ? match[1] : "attachment" };
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => apiFetch(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: (path) => apiFetch(path, { method: "DELETE" }),
};

// Client for the PUBLIC, anonymous whistleblower endpoints. Two differences from the
// staff `api` above: it targets the SafeVoice backend (where those endpoints live),
// and it never redirects to the staff login on an auth error (reporters have no
// account). Everything else — envelope unwrapping, error normalising — is identical.
export const publicApi = {
  get: (path) => apiFetch(path, { baseUrl: SAFEVOICE_API_URL, isPublic: true }),
  post: (path, body) =>
    apiFetch(path, {
      baseUrl: SAFEVOICE_API_URL,
      isPublic: true,
      method: "POST",
      body: JSON.stringify(body),
    }),
  // Multipart POST for anonymous reporter uploads (a message + evidence files).
  postForm: (path, formData) =>
    apiFetch(path, {
      baseUrl: SAFEVOICE_API_URL,
      isPublic: true,
      method: "POST",
      body: formData,
    }),
  // Download a file from the reporter's own case thread (access key travels in the JSON body).
  downloadFile: (path, body) =>
    downloadFile(path, {
      baseUrl: SAFEVOICE_API_URL,
      isPublic: true,
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// Client for the STAFF (internal compliance) endpoints. It targets the SafeVoice
// backend. Authentication is the shared httpOnly idToken cookie ONLY (sent by
// credentials:'include' in apiFetch): the SafeVoice backend forwards it to RegulaOne
// to identify the caller and derives the tenant + acting user from that verified
// session. So this client sends NO tenant/actor headers — doing so would be both
// pointless (the backend ignores them) and unsafe (client-supplied identity can be
// spoofed). It keeps the normal staff-auth behaviour: a 401 tries a silent refresh
// and then the login.
export const staffApi = {
  get: (path) => apiFetch(path, { baseUrl: SAFEVOICE_API_URL }),
  post: (path, body) =>
    apiFetch(path, {
      baseUrl: SAFEVOICE_API_URL,
      method: "POST",
      body: JSON.stringify(body),
    }),
  // Multipart POST for staff uploads (a message + evidence files). The internal message
  // endpoint reads a "text" field and zero or more "files" parts.
  postForm: (path, formData) =>
    apiFetch(path, {
      baseUrl: SAFEVOICE_API_URL,
      method: "POST",
      body: formData,
    }),
  // Download an evidence file (staff side); gated server-side to the export roles.
  downloadFile: (path) => downloadFile(path, { baseUrl: SAFEVOICE_API_URL }),
  // PATCH endpoints carry their inputs as query params (?status=…), so most calls
  // send no body; `body` stays optional for the rare case one is needed.
  patch: (path, body) =>
    apiFetch(path, {
      baseUrl: SAFEVOICE_API_URL,
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  del: (path) =>
    apiFetch(path, { baseUrl: SAFEVOICE_API_URL, method: "DELETE" }),
};

// Exposed so the logout flow can reach the central login as a last-resort fallback,
// and so the landing page can link its Login / Sign Up buttons at the central app.
export const CENTRAL_LOGIN_URL = CENTRAL_LOGIN;
export const CENTRAL_SIGNUP_URL = CENTRAL_SIGNUP;
export const REGULAONE_API_BASE = REGULAONE_API_URL;
// Base URL of the SafeVoice backend — used to open the WebSocket ("/ws").
export const SAFEVOICE_API_BASE = SAFEVOICE_API_URL;
