// Central HTTP client — wraps fetch with baseURL, credentials (HTTP-only cookie forwarding),
// JSON content-type, unified error handling, and silent token refresh on 401.

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

// Tracks whether a refresh is already in flight so concurrent 401s only trigger one refresh call.
let refreshInProgress = null;

async function request(method, path, body, _retry = false) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    // credentials: 'include' — browser attaches HTTP-only cookies (idToken, accessToken, refreshToken)
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  // Silent token refresh on 401 (idToken/accessToken expired after 1 hour).
  // Skip for the refresh and login endpoints themselves to avoid infinite loops.
  if (
    res.status === 401 &&
    !_retry &&
    path !== '/api/auth/refresh' &&
    path !== '/api/auth/login'
  ) {
    try {
      // Deduplicate: if multiple requests got 401 simultaneously, only one refresh fires.
      if (!refreshInProgress) {
        refreshInProgress = fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        }).finally(() => { refreshInProgress = null; });
      }
      const refreshRes = await refreshInProgress;

      if (refreshRes.ok) {
        // New idToken + accessToken cookies are now set — retry the original request once.
        return request(method, path, body, true);
      }
    } catch {
      // Network error during refresh — fall through to redirect
    }

    // Refresh failed (expired refresh token) — clear state and force re-login.
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(payload.message ?? 'Request failed');
  }

  if (res.status === 204) return undefined;

  return res.json();
}

export const api = {
  get:  (path)        => request('GET',    path),
  post: (path, body)  => request('POST',   path, body),
  put:  (path, body)  => request('PUT',    path, body),
  del:  (path)        => request('DELETE', path),
};
