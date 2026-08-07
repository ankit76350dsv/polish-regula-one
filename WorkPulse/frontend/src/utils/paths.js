// Tenant-scoped URL helpers for WorkPulse.
//
// WHAT THIS IS FOR
// Every signed-in page now lives under "/company/{tenantId}/…", for example:
//   http://localhost:3005/company/6f3a…/records
// so the address bar always shows WHICH organisation (tenant) the hours on screen
// belong to. This is the same URL shape the other RegulaOne apps already use
// (WasteSync, SafeWork, KSeFFlow), so a link looks the same everywhere on the
// platform.
//
// WHY IT MATTERS FOR AUDITS
// Working time records are legal evidence (Kodeks pracy art. 149) and must be kept
// for years. When a screenshot or a support ticket shows a bare "/records" URL,
// nobody can tell afterwards which company was on screen. With the tenant id in the
// address that question answers itself, which helps during a PIP inspection and
// stops accidental "wrong company" corrections.
//
// IMPORTANT — THIS IS A SCREEN FEATURE, NOT A SECURITY FEATURE
// The tenant id in the URL is never sent to the backend as a trusted value. The
// WorkPulse API reads the tenant from the signed-in session (see the backend's auth
// middleware) and ignores anything the browser claims, because a value in the
// address bar can be typed by hand. So the URL tells the USER which company they
// are in; the SERVER decides which company's data they may actually touch.
//
// The tenant id itself comes from the central RegulaOne login: GET /api/auth/me
// returns it in the user object, and AuthContext mirrors that user into Redux.
import { useSelector } from "react-redux";

// The one place the "/company/{id}" shape is written down.
export const ORG_PATH_PREFIX = "/company";

// The name of the first page after signing in.
//
// WHY HOME HAS ITS OWN NAME
// It used to be the nameless page at "/" (an "index" route), which meant the menu
// item for it had no address of its own to point at. A named page is easier to
// bookmark, easier to talk about in a support ticket ("open /home"), and it makes
// the highlighted menu item follow the same rule as every other item. The bare
// "/company/{tenantId}" address still works — it forwards here.
export const HOME_SUBPATH = "/home";

// Build a tenant-scoped path.
// Example: orgPath("abc", "/records") -> "/company/abc/records"
//          orgPath("abc")             -> "/company/abc"   (forwards to /home)
export function orgPath(tenantId, sub = "") {
  return `${ORG_PATH_PREFIX}/${tenantId}${sub}`;
}

// Hook: the "/company/{tenantId}" start of every link for the CURRENT user.
//
// Use it in any signed-in component and stick the rest of the address on the end:
//   const base = useOrgBase();
//   <Link to={`${base}/records`}>Time records</Link>
//
// Returns an empty string while we do not know the tenant yet (the very first
// render, before /api/auth/me has answered). An empty base keeps the link pointing
// at the app root instead of building a broken "/company/undefined/…" address; the
// guards then send the user to the right place once /me arrives.
export function useOrgBase() {
  const tenantId = useSelector((state) => state.auth.user?.tenantId);
  return tenantId ? orgPath(tenantId) : "";
}

// Hook: the full address of the CURRENT user's home page, e.g.
// "/company/abc/home". Use it for every "take me back to the start" link so the
// word "home" is never typed twice in the codebase.
//
// Falls back to "/" while the tenant is still unknown — the app root forwards to
// this same page as soon as /api/auth/me answers.
export function useOrgHome() {
  const base = useOrgBase();
  return base ? `${base}${HOME_SUBPATH}` : "/";
}
