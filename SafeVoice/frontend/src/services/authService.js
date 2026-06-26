/**
 * SafeVoice authentication service.
 *
 * These are the only network calls involved in signing in. SafeVoice has NO login
 * form of its own — identity comes entirely from the central RegulaOne session
 * (the shared-domain idToken cookie). This file just:
 *   1. asks the RegulaOne backend "who am I?" (GET /api/auth/me), and
 *   2. ends the session (POST /api/sso/logout).
 *
 * The Redux authSlice calls these from its async thunks; components never call
 * them directly (per the project's Redux Toolkit rules).
 */
import { tryRefreshSession, REGULAONE_API_BASE } from "./api";
import { normalizeUser } from "../utils/permissions";

/**
 * Ask the RegulaOne backend who the current user is, using the shared-domain
 * cookie. We use a RAW fetch here (not apiFetch) on purpose: during the initial
 * session check a clean 401 means "not signed in" and should lead to the login
 * redirect, NOT to apiFetch's automatic redirect. We still try ONE silent refresh
 * first so a token that just expired does not bounce the user out unnecessarily.
 *
 * @param {AbortSignal} [signal] lets the caller time out a dead/slow backend.
 * @returns {Promise<object>} the mapped current-user object.
 * @throws  {Error} message "not authenticated" for a clean 401/403; otherwise a
 *          transient error (network/timeout) the UI can show with a Retry button.
 */
export async function fetchMe(signal) {
  const callMe = () =>
    fetch(`${REGULAONE_API_BASE}/api/auth/me`, { credentials: "include", signal });

  let res = await callMe();

  // Token may have just expired → try one silent refresh, then ask again.
  if ((res.status === 401 || res.status === 403) && (await tryRefreshSession())) {
    res = await callMe();
  }

  // A clean "not signed in" is NOT a transient error — flag it distinctly so the
  // slice routes it to the login redirect instead of the retry screen.
  if (res.status === 401 || res.status === 403) {
    throw new Error("not authenticated");
  }
  if (!res.ok) {
    // Network/proxy/5xx — transient, the user can retry.
    throw new Error(`Could not verify session (${res.status})`);
  }

  const json = await res.json().catch(() => null);
  // /api/auth/me returns AppResponse<UserResponse> — unwrap the envelope, then
  // normalise into the exact shape the rest of the app relies on (raw platform
  // role + raw permissions + the derived SafeVoice display role). The access gate
  // (utils/access.js) and permission checks (utils/permissions.js) read this.
  const user = normalizeUser(json?.data ?? json);
  if (!user) throw new Error("Malformed session response");
  return user;
}

/**
 * End the SSO session. POST /api/sso/logout clears the shared-domain auth cookies
 * and returns AppResponse<{ logoutUrl }>. We return the logout URL so the caller
 * can send the browser there (which finishes sign-out on the central app).
 *
 * @returns {Promise<string|null>} the central logout URL, or null if unavailable.
 */
export async function logout() {
  const res = await fetch(`${REGULAONE_API_BASE}/api/sso/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const data = json?.data ?? json;
  return data?.logoutUrl ?? null;
}
