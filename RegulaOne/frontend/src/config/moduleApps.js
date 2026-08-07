/**
 * Where each compliance module actually RUNS.
 *
 * Every module (KSeFFlow, SafeVoice, PrivacyPilot, …) is its own application on its own
 * port/domain, not a page inside RegulaOne. RegulaOne is the hub: it decides who may open
 * a module and then sends the person there. This file is the one place that knows the
 * address of each app.
 *
 * ── HOW AN ADDRESS IS DECIDED (in order) ────────────────────────────────────────
 *
 *   1. An explicit environment variable, e.g. VITE_KSEFFLOW_URL=https://ksefflow.regulaone.eu
 *      That is how staging and production are configured — no code change.
 *   2. Otherwise: the SAME host the hub itself was opened on, with the module's dev port.
 *      So opening RegulaOne at http://localhost:3000 gives http://localhost:3001, and
 *      opening it at http://192.168.x.y:3000 gives http://192.168.x.y:3001. One dev
 *      server, works on the machine and over the LAN, no rebuild. This mirrors what
 *      src/config/sso.js already does for the backend URL, and it matters here for the
 *      same reason: the session cookie is shared per host, so a module opened on a
 *      DIFFERENT host than the hub would not be signed in.
 *
 * ── ADDING THE REMAINING MODULES ────────────────────────────────────────────────
 *
 * Only the three apps that exist today are listed. A module that is NOT listed simply has
 * no external app yet — the sidebar then keeps its in-hub page instead of trying to open a
 * window that would 404. To wire one up later, add a line here and an entry in
 * .env.example. Nothing else needs to change.
 */

// Same runtime-host resolution as src/config/sso.js — see the note above.
const _proto = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const _host  = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const _at = (port) => `${_proto}//${_host}:${port}`;

/**
 * Module key (the backend's TenantModule enum) → base URL of that application.
 * Keys must match the values in the /api/auth/me `moduleIds` list exactly.
 */
export const MODULE_APP_URLS = {
  KSEFFLOW:     import.meta.env.VITE_KSEFFLOW_URL     || _at(3001),
  SAFEVOICE:    import.meta.env.VITE_SAFEVOICE_URL    || _at(1003),
  PRIVACYPILOT: import.meta.env.VITE_PRIVACYPILOT_URL || _at(3006),
  // SAFEWORK / WASTESYNC / WORKPULSE: no separate application yet.
};

/**
 * The landing page inside a module app for one company.
 *
 * Every module app uses the same route shape, so it is written once here. The company id
 * comes from the signed-in user's own profile (/api/auth/me), never from the address bar —
 * and the module app checks the session itself, so this URL grants nothing on its own.
 */
const dashboardPath = (tenantId) => `/company/${encodeURIComponent(tenantId)}/dashboard`;

/**
 * The full URL to open for a module, or NULL when there is nothing to open.
 *
 * Null means one of two things, and the caller treats both the same way (keep the in-hub
 * page instead of opening a window):
 *   * the module has no separate application yet, or
 *   * the person has no organisation, so there is no company dashboard to land on
 *     (a platform super-admin belongs to no single company).
 *
 * @param {string} moduleKey e.g. "KSEFFLOW"
 * @param {string|null|undefined} tenantId the signed-in person's company id
 * @returns {string|null}
 */
export function moduleAppUrl(moduleKey, tenantId) {
  const baseUrl = MODULE_APP_URLS[moduleKey];
  if (!baseUrl || !tenantId) return null;
  return `${baseUrl}${dashboardPath(tenantId)}`;
}

/** True when this module runs as its own application (so it opens in a new tab). */
export function hasModuleApp(moduleKey) {
  return Boolean(MODULE_APP_URLS[moduleKey]);
}

/**
 * Where a link to a module should actually go.
 *
 * The server sends in-hub paths with its dashboard figures (e.g. "/modules/ksef" on a
 * "needs attention" row). For a module that has since moved into its own application
 * that path no longer exists here, so following it blindly would land the person on a
 * "page not found" — the dashboard would be pointing at doors that are no longer there.
 * This function decides the honest destination instead, and every link on the overview
 * screen goes through it.
 *
 * @param {string} moduleKey  e.g. "KSEFFLOW"
 * @param {string|null} tenantId the signed-in person's company id
 * @param {string|null} inHubPath the app-relative path the server suggested, e.g. "/modules/safework"
 * @param {string} companyBase prefix for in-hub routes, e.g. "/company/abc123"
 * @returns {{external: true, href: string} | {external: false, to: string} | null}
 *          null means there is nothing safe to open, so the caller renders plain text
 *          rather than a link that would fail.
 */
export function moduleDestination(moduleKey, tenantId, inHubPath, companyBase) {
  // Its own application: open the app itself. We can only send people to the app's
  // dashboard — the deep path the server suggested belongs to this hub's old pages and
  // has no equivalent over there, so it is deliberately not appended.
  if (hasModuleApp(moduleKey)) {
    const href = moduleAppUrl(moduleKey, tenantId);
    return href ? { external: true, href } : null;
  }

  // Still a page inside this hub.
  if (inHubPath && companyBase) {
    return { external: false, to: `${companyBase}${inHubPath}` };
  }

  return null;
}
