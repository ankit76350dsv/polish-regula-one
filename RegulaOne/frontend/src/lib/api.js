// Central HTTP client — wraps fetch with baseURL, credentials (HTTP-only cookie forwarding),
// JSON content-type, and unified error handling so every service function stays clean.

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    // credentials: 'include' — the browser will automatically attach HTTP-only cookies
    // (idToken, accessToken, refreshToken) set by the backend on every request.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  if (!res.ok) {
    // Attempt to parse the error body — backend returns { message: "..." } for 4xx errors.
    const payload = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(payload.message ?? 'Request failed');
  }

  // 204 No Content — nothing to parse
  if (res.status === 204) return undefined;

  return res.json();
}

export const api = {
  get:  (path)               => request('GET',    path),
  post: (path, body)         => request('POST',   path, body),
  put:  (path, body)         => request('PUT',    path, body),
  del:  (path)               => request('DELETE', path),
};
