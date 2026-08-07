// Tenant-scoped URL helpers for SafeWork.
//
// WHAT THIS IS FOR
// Every signed-in page now lives under "/company/{tenantId}/…", for example:
//   http://localhost:3002/company/6f3a…/employees
// so the address bar always shows WHICH organisation (tenant) the records on
// screen belong to. This is the same URL shape the other RegulaOne apps use
// (KSeFFlow, PrivacyPilot, WasteSync), so a link looks the same everywhere.
//
// WHY IT MATTERS FOR AUDITS
// SafeWork holds medical certificates and BHP training records — employee health
// and safety data. When a screenshot or a support ticket shows a bare "/employees"
// URL, nobody can tell afterwards whose staff list was on screen. With the tenant
// id in the address that question answers itself, which helps during a labour
// inspection and makes accidental "wrong company" edits much less likely.
//
// IMPORTANT — THIS IS A SCREEN FEATURE, NOT A SECURITY FEATURE
// The tenant id in the URL is never sent to the backend as a trusted value. The
// SafeWork API reads the tenant from the signed-in session and ignores anything
// the browser claims, because a value in the address bar can be typed by hand. So
// the URL tells the USER which company they are in; the SERVER decides which
// company's data they may actually touch. That matters more here than almost
// anywhere: employee health records must never cross a tenant boundary (GDPR).
//
// The tenant id itself comes from the central RegulaOne login: GET /api/auth/me
// returns it in the user object, and AuthContext mirrors that user into Redux.
import { useSelector } from "react-redux";

// The one place the "/company/{id}" shape is written down.
export const ORG_PATH_PREFIX = "/company";

// The name of the first page after signing in.
//
// WHY THE LANDING PAGE HAS ITS OWN NAME
// It used to be the nameless page at "/" (an "index" route), which meant the menu
// item for it had no address of its own to point at. A named page is easier to
// bookmark, easier to talk about in a support ticket ("open /home"), and it makes
// the highlighted menu item follow the same rule as every other item. The bare
// "/company/{tenantId}" address still works — it forwards here.
export const HOME_SUBPATH = "/home";

// Build a tenant-scoped path.
// Example: orgPath("abc", "/employees") -> "/company/abc/employees"
//          orgPath("abc")               -> "/company/abc"
export function orgPath(tenantId, sub = "") {
  return `${ORG_PATH_PREFIX}/${tenantId}${sub}`;
}

// Hook: the "/company/{tenantId}" start of every link for the CURRENT user.
//
// Use it in any signed-in component and stick the rest of the address on the end:
//   const base = useOrgBase();
//   <Link to={`${base}/employees`}>Employees</Link>
//
// Returns an empty string while we do not know the tenant yet (the very first
// render, before /api/auth/me has answered). An empty base keeps the link
// pointing at the app root instead of building a broken "/company/undefined/…"
// address; the guards then send the user to the right place once /me arrives.
export function useOrgBase() {
  const tenantId = useSelector((state) => state.auth.user?.tenantId);
  return tenantId ? orgPath(tenantId) : "";
}

// Hook: the full address of the CURRENT user's home page, e.g.
// "/company/abc/home". Use it for every "take me back to the start" link so the
// word "home" is never typed twice in the codebase.
//
// Falls back to "/" while the tenant is still unknown — the app root forwards to
// this same page as soon as /me answers.
export function useOrgHome() {
  const base = useOrgBase();
  return base ? `${base}${HOME_SUBPATH}` : "/";
}

// Strip the "/company/{tenantId}" start off a full address, leaving the page part.
//
// Used by screens that SHOW the current address to the user (the placeholder page
// builds its title from it). Without this they would print the tenant id on the
// page, which is noise for the reader and an internal identifier we have no reason
// to display.
//
// Example: "/company/abc/services/risk-assessment" -> "/services/risk-assessment"
export function stripOrgPrefix(pathname = "") {
  const parts = pathname.split("/"); // "/company/abc/x" -> ["", "company", "abc", "x"]

  if (parts[1] === "company" && parts[2]) {
    const rest = parts.slice(3).join("/");
    return rest ? `/${rest}` : "/";
  }

  return pathname;
}
