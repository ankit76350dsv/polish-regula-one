/**
 * SSO service — cross-app authentication helpers.
 * No Cognito Hosted UI, no PKCE. Authentication always uses the custom
 * RegulaOne login form. SSO works through shared-domain HTTP-only cookies.
 *
 * Cross-app login flow:
 *   1. Module app has no session → calls redirectToSSO('/some/path')
 *   2. Browser → GET /api/sso/login?redirect_uri=<module/auth/sso-callback>&state=...
 *   3. Backend → 302 to app.regulaone.eu/login?sso=1&redirect_uri=...&state=...
 *   4. User fills in login form
 *   5. Shared-domain cookies set (Domain=.regulaone.eu)
 *   6. useLogin hook sees ?redirect_uri → window.location.href to module app
 *   7. Module app's SSOCallbackPage runs initAuth() → authenticated
 */

import { SSO_APP_ID, SSO_APP_URL, SSO_LOGIN_ENDPOINT, SSO_API_URL, SSO_CALLBACK_PATH } from '../config/sso';

// ── State encoding ─────────────────────────────────────────────────────────

/**
 * Encodes app ID and return path into URL-safe Base64.
 * Format: "appId|returnPath" — matches SSOService.encodeState() on the backend.
 */
function encodeState(appId, returnPath) {
  const raw = `${appId || SSO_APP_ID}|${returnPath || '/'}`;
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decodes state back into { appId, returnPath }.
 */
export function decodeState(state) {
  try {
    if (!state) return { appId: SSO_APP_ID, returnPath: '/' };
    const padded  = state.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = decodeURIComponent(escape(atob(padded)));
    const [appId, returnPath = '/'] = decoded.split('|');
    return { appId, returnPath };
  } catch {
    return { appId: SSO_APP_ID, returnPath: '/' };
  }
}

// ── SSO Login Redirect ──────────────────────────────────────────────────────

/**
 * Redirects the browser to the backend SSO login endpoint which forwards
 * the user to the central login page with redirect_uri preserved.
 *
 * After successful login on the central app, useLogin hook reads ?redirect_uri
 * and does a full-page redirect back to this app's /auth/sso-callback, which
 * runs initAuth() to restore the session from the shared-domain cookie.
 *
 * @param {string} returnPath  The path to navigate to after auth (e.g. '/invoices').
 */
export function redirectToSSO(returnPath = '/') {
  const state       = encodeState(SSO_APP_ID, returnPath);
  const callbackUri = encodeURIComponent(`${SSO_APP_URL}${SSO_CALLBACK_PATH}`);
  const loginUrl    = `${SSO_LOGIN_ENDPOINT}?redirect_uri=${callbackUri}&state=${state}`;
  window.location.href = loginUrl;
}

// ── SSO Logout ──────────────────────────────────────────────────────────────

/**
 * Redirects the browser to the logout destination.
 * Cookies are already cleared by authService.ssoLogout() before this is called —
 * this function only handles the final browser redirect.
 *
 * @param {string|null} logoutUrl  logoutUrl from the backend logout response.
 */
export function triggerSSOLogout(logoutUrl = null) {
  const centralLogin = import.meta.env.VITE_CENTRAL_LOGIN_URL
    ?? `${SSO_APP_URL}/login`;

  window.location.href = logoutUrl || centralLogin;
}

// ── Session Check ───────────────────────────────────────────────────────────

/**
 * Quick session probe. Returns user profile if a valid cookie exists, else null.
 */
export async function checkSSOSession() {
  try {
    const res = await fetch(`${SSO_API_URL}/api/auth/me`, {
      credentials: 'include',
    });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}
