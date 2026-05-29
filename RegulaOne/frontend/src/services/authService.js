// Pure async functions that call the backend auth API.
// No state, no side-effects — just fetch wrappers that can be composed in hooks.

import { api } from '../lib/api';

export const authService = {

  // ── Registration ────────────────────────────────────────────────────────────

  // POST /api/auth/signup
  signup: (data) =>
    api.post('/api/auth/signup', data),

  // POST /api/auth/confirm
  confirmSignup: (data) =>
    api.post('/api/auth/confirm', data),

  // POST /api/auth/resend-code?email=...
  resendCode: (email) =>
    api.post(`/api/auth/resend-code?email=${encodeURIComponent(email)}`),

  // ── Profile ─────────────────────────────────────────────────────────────────

  // GET /api/auth/me
  getMe: () =>
    api.get('/api/auth/me'),

  // PATCH /api/auth/me
  updateMe: (data) =>
    api.patch('/api/auth/me', data),

  // PUT /api/auth/change-password
  changePassword: (data) =>
    api.put('/api/auth/change-password', data),

  // ── Cookie-based auth flows (live in SSOController at /api/sso/*) ──────────

  // POST /api/sso/login
  login: (data) =>
    api.post('/api/sso/login', data),

  // POST /api/sso/respond-challenge
  respondChallenge: (data) =>
    api.post('/api/sso/respond-challenge', data),

  // POST /api/sso/refresh
  refresh: () =>
    api.post('/api/sso/refresh'),

  // POST /api/sso/logout  — uses raw fetch (not api.post) so a 401 (token already
  // expired) is returned as a normal error; the useLogout onError still clears state.
  ssoLogout: async () => {
    const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
    const res = await fetch(`${baseUrl}/api/sso/logout`, {
      method:      'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Logout failed');
    return res.json();
  },
};
