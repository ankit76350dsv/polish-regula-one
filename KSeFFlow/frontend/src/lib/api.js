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
const APP_URL       = import.meta.env.VITE_APP_URL           ?? 'http://localhost:3001';
const CENTRAL_LOGIN = import.meta.env.VITE_CENTRAL_LOGIN_URL ?? 'http://localhost:3000/login';

export const SSO_CALLBACK_URL = `${APP_URL}/auth/sso-callback`;

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
    const returnTo = encodeURIComponent(SSO_CALLBACK_URL);
    window.location.href = `${CENTRAL_LOGIN}?redirect_uri=${returnTo}`;
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
