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

const API_URL       = import.meta.env.VITE_API_URL          ?? 'http://localhost:8080';
const KSEF_API_URL  = import.meta.env.VITE_KSEF_API_URL      ?? 'http://localhost:8081';
const APP_URL       = import.meta.env.VITE_APP_URL           ?? 'http://localhost:3001';
const CENTRAL_LOGIN = import.meta.env.VITE_CENTRAL_LOGIN_URL ?? 'http://localhost:3000/login';

export const SSO_CALLBACK_URL = `${APP_URL}/auth/sso-callback`;

function redirectToLogin() {
  const returnTo = encodeURIComponent(SSO_CALLBACK_URL);
  window.location.href = `${CENTRAL_LOGIN}?redirect_uri=${returnTo}`;
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
 *   - 401 → central login redirect; 403 (no org / forbidden) and other errors throw a
 *     normalised Error the UI can display.
 *
 * Returns parsed JSON (or raw text for non-JSON bodies such as UPO XML), null on 204.
 */
export async function ksefFetch(path, options = {}) {
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
    redirectToLogin();
    throw new Error('Session expired — redirecting to login');
  }
  if (res.status === 204) return null;
  if (!res.ok) throw await normaliseError(res);

  const text = await res.text().catch(() => '');
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
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
