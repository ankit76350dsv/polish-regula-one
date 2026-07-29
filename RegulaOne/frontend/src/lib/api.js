// Central HTTP client — wraps fetch with baseURL, credentials (HTTP-only cookie forwarding),
// JSON content-type, unified error handling, and silent token refresh on 401.
//
// Response envelope: every endpoint returns AppResponse<T>:
//   { success, message, data, errorCode, status }
//
// This module transparently unwraps the envelope so callers receive `data` on success
// and a thrown Error (with .message and .errorCode) on failure.
//
// Session expiry strategy:
//   1. Any request returns 401 → try POST /api/sso/refresh (silent token refresh)
//   2. If refresh succeeds    → retry the original request once
//   3. If refresh also fails  → redirectToSSO() sends user to central login

import { redirectToSSO } from '../services/ssoService';
import { SSO_API_URL } from '../config/sso';

// Resolved from config/sso.js: an explicit VITE_API_URL if set, otherwise derived
// from the current host so localhost and the LAN IP both work with one dev server.
const BASE_URL = SSO_API_URL;

// Tracks whether a refresh is already in flight so concurrent 401s only trigger one refresh call.
let refreshInProgress = null;

async function request(method, path, body, _retry = false) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  // Silent token refresh on 401.
  // Skip for the refresh and login endpoints themselves to avoid infinite loops.
  if (
    res.status === 401 &&
    !_retry &&
    path !== '/api/sso/refresh' &&
    path !== '/api/sso/login'
  ) {
    try {
      if (!refreshInProgress) {
        refreshInProgress = fetch(`${BASE_URL}/api/sso/refresh`, {
          method: 'POST',
          credentials: 'include',
        }).finally(() => { refreshInProgress = null; });
      }
      const refreshRes = await refreshInProgress;

      if (refreshRes.ok) {
        return request(method, path, body, true);
      }
    } catch {
      // Network error during refresh — fall through to redirect
    }

    redirectToSSO(window.location.pathname);
    throw new Error('Session expired. Please log in again.');
  }

  // Parse body — safe even for 4xx/5xx since the backend always returns JSON
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    // Extract message and errorCode from AppResponse envelope if present
    const message   = json?.message   ?? res.statusText ?? 'Request failed';
    const errorCode = json?.errorCode ?? 'UNKNOWN_ERROR';
    const err = new Error(message);
    err.errorCode  = errorCode;
    err.httpStatus = json?.status ?? res.status;
    throw err;
  }

  if (res.status === 204 || json === null) return undefined;

  // Unwrap AppResponse envelope: { success, message, data, errorCode, status }
  if (json && typeof json === 'object' && 'success' in json) {
    if (!json.success) {
      const err = new Error(json.message ?? 'Request failed');
      err.errorCode  = json.errorCode;
      err.httpStatus = json.status;
      throw err;
    }
    return json.data;
  }

  // Fallback for any endpoint not using the envelope (e.g. CSV export)
  return json;
}

export const api = {
  get:   (path)        => request('GET',    path),
  post:  (path, body)  => request('POST',   path, body),
  put:   (path, body)  => request('PUT',    path, body),
  patch: (path, body)  => request('PATCH',  path, body),
  del:   (path)        => request('DELETE', path),
};
