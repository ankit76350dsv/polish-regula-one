// URL scheme for SafeVoice.
//
// THE IDEA (read this once and the rest is obvious):
// Inside the app we think in short "logical" paths — "/dashboard", "/cases/abc".
// But in the address bar the staff area is namespaced under the signed-in user's
// organisation, exactly like KSeFFlow:
//
//     logical            →  browser URL
//     /dashboard         →  /company/{tenantId}/dashboard
//     /cases/abc         →  /company/{tenantId}/cases/abc
//     /report            →  /report           (public — never prefixed)
//
// Keeping the app on logical paths means the page switch, the route guard, and the
// active-link highlighting never have to know about tenant ids. Only these two tiny
// converters do. App.jsx calls toBrowserPath() when it pushes a URL and
// toLogicalPath() when it reads one back (on load / Back button).

// The staff sections that live under /company/{tenantId}/… . Everything else
// (report, track, report/success, access-denied, auth/sso-callback) stays flat.
export const STAFF_SECTIONS = ["dashboard", "cases", "messages", "audits", "users", "settings"];

// Drop any "?query" / "#hash" so we only reason about the path itself.
function pathOnly(p) {
  return (p || "").split("?")[0].split("#")[0];
}

/**
 * Browser URL → internal logical path.
 *   /company/{tenantId}/cases/abc → /cases/abc
 *   /company/{tenantId}           → /dashboard   (the staff landing section)
 *   /report                       → /report      (unchanged)
 */
export function toLogicalPath(pathname) {
  const clean = pathOnly(pathname);
  const parts = clean.split("/").filter(Boolean);
  if (parts[0] === "company" && parts[1]) {
    const rest = parts.slice(2); // everything after the tenant id
    return rest.length ? `/${rest.join("/")}` : "/dashboard";
  }
  return clean || "/";
}

/**
 * Internal logical path → browser URL. Staff sections gain the /company/{tenantId}
 * prefix; public paths are returned unchanged. If there is no tenant id yet (e.g.
 * not signed in), the path is left flat — the route guard will handle the redirect.
 */
export function toBrowserPath(logicalPath, tenantId) {
  const clean = pathOnly(logicalPath);
  const parts = clean.split("/").filter(Boolean);
  if (tenantId && STAFF_SECTIONS.includes(parts[0])) {
    return `/company/${tenantId}/${parts.join("/")}`;
  }
  return clean || "/";
}

// Is this logical path part of the gated staff area?
export function isStaffSection(logicalPath) {
  const section = pathOnly(logicalPath).split("/").filter(Boolean)[0];
  return STAFF_SECTIONS.includes(section);
}

// ── Public anonymous report page ─────────────────────────────────────────────
// The "Submit report" button opens this in its own browser tab. The reporter
// sees ONLY the form — no navbar, no sidebar, no staff session — so a
// whistleblower can submit anonymously (EU 2019/1937 + Poland 2024 Act).
//
// The company the report belongs to travels in the URL itself:
//     /company/{tenantId}/report
// That lets the page know which organisation it is for, without ever needing
// the reporter to sign in or reveal who they are.

// Build the full address-bar URL for one company's public report page.
export function toPublicReportPath(tenantId) {
  return `/company/${tenantId}/report`;
}

// If the given browser path IS a standalone public report page, return the
// company (tenant) id from it. Otherwise return null. We only match the exact
// shape /company/{tenantId}/report so normal staff URLs are never mistaken for
// the anonymous page.
export function getStandaloneReportTenant(pathname) {
  const parts = pathOnly(pathname).split("/").filter(Boolean);
  if (parts[0] === "company" && parts[1] && parts[2] === "report" && parts.length === 3) {
    return parts[1];
  }
  return null;
}
