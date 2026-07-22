/**
 * Real HTTP client for PrivacyPilot's own feature APIs (the /api/privacypilot/**
 * endpoints on the PrivacyPilot backend — see ProcessingActivityController.java).
 *
 * This is the REAL counterpart to the mock transport in api.js. The mock file made
 * up data in the browser; this file actually talks to the Spring Boot backend.
 * It keeps the SAME contract the rest of the app already relies on:
 *   - authentication is the shared-domain RegulaOne session cookie (credentials:
 *     'include'); we never read or store the token in JavaScript;
 *   - the server answers with the standard envelope { success, message, data,
 *     errorCode, status } — on success we return `data`, on failure we throw an
 *     Error whose .message is the errorCode (so existing screens that check
 *     `err.message === 'FORBIDDEN'` keep working unchanged);
 *   - a just-expired token is refreshed ONCE silently and the call retried, exactly
 *     like the who-am-I flow, so users are not bounced out unnecessarily.
 *
 * RBAC and audit logging are enforced by the backend now (not in the browser), which
 * is where they must live for a real, audit-defensible compliance system.
 */
import { PRIVACYPILOT_API_BASE, tryRefreshSession, redirectToLogin } from './http';

/**
 * Do one authenticated JSON request and unwrap the AppResponse envelope.
 *
 * @param {string} path   e.g. "/api/privacypilot/activities" (leading slash).
 * @param {object} [opts] { method, body } — body is a plain object, JSON-encoded here.
 * @returns {Promise<any>} the `data` field of the success envelope.
 * @throws  {Error} .message = server errorCode (FORBIDDEN / NOT_FOUND / …) or a
 *          readable message; .code and .status carry the machine code and HTTP status.
 */
export async function apiRequest(path, { method = 'GET', body } = {}) {
  const url = `${PRIVACYPILOT_API_BASE}${path}`;

  // One attempt. Factored out so we can replay it after a silent token refresh.
  const attempt = () =>
    fetch(url, {
      method,
      // Always send the shared-domain session cookie; never a bearer token in JS.
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await attempt();

  // 401 = the session is missing/expired. Try one silent refresh, then replay once.
  if (res.status === 401 && (await tryRefreshSession())) {
    res = await attempt();
  }

  // Still not authenticated after a refresh → send the user to the central login.
  // (AuthGate also watches the session, but redirecting here stops a broken call
  // from silently failing.)
  if (res.status === 401) {
    redirectToLogin();
    throw makeError('Your session has expired. Please sign in again.', 'UNAUTHENTICATED', 401);
  }

  // Parse the envelope. A 204/empty body (should not happen with AppResponse, but be safe).
  const json = await res.json().catch(() => null);

  if (!res.ok || (json && json.success === false)) {
    // Prefer the machine errorCode as the thrown message so existing UI checks
    // (err.message === 'FORBIDDEN' / 'NOT_FOUND') keep working; fall back to the
    // human message, then the HTTP status text.
    const code = json?.errorCode ?? `HTTP_${res.status}`;
    const message = json?.message ?? res.statusText ?? 'Request failed';
    throw makeError(code, code, res.status, message);
  }

  // Success: hand back just the payload, exactly like the mock's apiGet/apiMutate did.
  return json ? json.data : null;
}

// Small helpers so calls read like the mock transport they replace.
export const get = (path) => apiRequest(path, { method: 'GET' });
export const post = (path, body) => apiRequest(path, { method: 'POST', body });
export const put = (path, body) => apiRequest(path, { method: 'PUT', body });
export const del = (path) => apiRequest(path, { method: 'DELETE' });

// Build an Error that carries both the machine code (as .message AND .code, so it
// survives Redux Toolkit's error serialisation) and the human-readable server text.
function makeError(messageForUi, code, status, serverMessage) {
  const err = new Error(messageForUi);
  err.code = code;
  err.status = status;
  if (serverMessage) err.serverMessage = serverMessage;
  return err;
}
