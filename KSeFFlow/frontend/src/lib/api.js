/**
 * Central HTTP client for KSeFFlow.
 * All requests include credentials: 'include' so the browser forwards the
 * shared-domain idToken cookie set by the RegulaOne backend at localhost:8080.
 * On 401 (session expired or missing): redirects to the central login page
 * with ?redirect_uri pointing back to this app's /auth/sso-callback route
 * so the user lands here automatically after authenticating on the main app.
 */

const API_URL         = import.meta.env.VITE_API_URL          ?? 'http://localhost:8080';
const APP_URL         = import.meta.env.VITE_APP_URL           ?? 'http://localhost:3001';
const CENTRAL_LOGIN   = import.meta.env.VITE_CENTRAL_LOGIN_URL ?? 'http://localhost:3000/login';

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

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(payload.message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get:    (path)         => apiFetch(path),
  post:   (path, body)   => apiFetch(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:    (path, body)   => apiFetch(path, { method: 'PUT',   body: JSON.stringify(body) }),
  patch:  (path, body)   => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del:    (path)         => apiFetch(path, { method: 'DELETE' }),
};
