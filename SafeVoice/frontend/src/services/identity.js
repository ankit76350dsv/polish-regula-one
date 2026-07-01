/**
 * Current staff tenant holder.
 *
 * The staff SafeVoice backend endpoints identify the caller purely from the shared
 * httpOnly idToken cookie (see api.js → staffApi): the backend forwards it to RegulaOne
 * and derives BOTH the tenant and the acting user from that verified session. So the
 * frontend no longer sends any tenant/actor headers to the SafeVoice backend.
 *
 * The one thing still needed here is the inviter's own tenantId: inviting a user is a
 * RegulaOne (identity) admin action whose payload includes the inviter's organisation,
 * and userService is plain JavaScript that cannot use React hooks to read the store. So
 * we keep a tiny copy of the signed-in user's tenantId here. The Redux store updates it
 * whenever the logged-in user changes (see store.js). This keeps the service layer free
 * of any import of the store, avoiding a circular dependency.
 *
 * SECURITY NOTE: this value is only used to fill the RegulaOne invite payload; RegulaOne
 * still verifies the inviter's session and tenant server-side — a client value can always
 * be forged. (See CLAUDE.md §6, §9.)
 */

// Starts empty: before login there is no staff tenant.
let currentActor = { tenantId: "" };

// Replace the remembered tenant. Called by the store whenever auth state changes.
// Passing a falsy user clears it (e.g. on sign-out).
export function setCurrentActor(user) {
  currentActor = { tenantId: user?.tenantId || "" };
}

// Read the remembered tenant (used by userService to fill the RegulaOne invite payload).
export function getCurrentActor() {
  return currentActor;
}
