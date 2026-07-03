// Mock authentication. In production this is replaced by the RegulaOne
// OAuth2/OIDC flow (central SSO) — see RegulaOne/frontend/src/services/authService.js.
// The demo password for every seeded account is "demo123".
import { apiGet } from './api';

const DEMO_PASSWORD = 'demo123';
const SESSION_KEY = 'pp_session_v1';

export const authService = {
  async login(email, password) {
    const users = await apiGet((db) => db.users);
    const user = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.active,
    );
    if (!user || password !== DEMO_PASSWORD) {
      const err = new Error('INVALID_CREDENTIALS');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  },

  async restore() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async logout() {
    sessionStorage.removeItem(SESSION_KEY);
  },
};
