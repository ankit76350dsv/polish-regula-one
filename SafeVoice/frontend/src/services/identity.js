/**
 * Current staff identity holder.
 *
 * The internal (staff) backend endpoints identify the caller through three request
 * headers — the organisation (X-Tenant-ID) and who is acting (X-Actor-Role,
 * X-Actor-ID). That information lives in the Redux auth state, but the service layer
 * is plain JavaScript and cannot use React hooks to read it.
 *
 * So we keep a tiny copy of the signed-in actor here. The Redux store updates it
 * whenever the logged-in user changes (see store.js), and the HTTP client
 * (api.js → staffApi) reads it to attach the headers to every staff call. This keeps
 * api.js free of any import of the store, avoiding a circular dependency.
 *
 * SECURITY NOTE: these headers are a convenience for the current backend contract.
 * They are client-supplied, so the backend MUST still verify the caller's session
 * and tenant server-side — a header can always be forged. (See CLAUDE.md §6, §9.)
 */

// Starts empty: before login there is no staff actor.
let currentActor = { tenantId: "", actorRole: "", actorId: "" };

// Replace the remembered actor. Called by the store whenever auth state changes.
// Passing a falsy user clears it (e.g. on sign-out).
export function setCurrentActor(user) {
  if (!user) {
    currentActor = { tenantId: "", actorRole: "", actorId: "" };
    return;
  }
  currentActor = {
    tenantId: user.tenantId || "",
    // The acting role: prefer the SafeVoice role code, fall back to the platform role.
    actorRole: user.safeVoiceRole || user.role || "",
    // There is no separate user id in the session, so the email is the stable actor id.
    actorId: user.email || "",
  };
}

// Read the remembered actor (used by the staff HTTP client to build headers).
export function getCurrentActor() {
  return currentActor;
}
