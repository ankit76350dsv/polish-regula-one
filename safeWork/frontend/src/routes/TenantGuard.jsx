import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { ACCESS } from "../config/moduleAccess";
import AccessRestricted from "../pages/AccessRestricted";
import { HOME_SUBPATH, orgPath } from "../utils/paths";

// TenantGuard sits on the "/company/:tenantId" part of the address.
//
// WHERE IT RUNS IN THE CHAIN
//   ProtectedRoute      -> "are you signed in at all?"
//   ModuleAccessGuard   -> "may you use SafeWork?" (licence, plan, permission)
//   TenantGuard (here)  -> "does the company in the address match YOUR company?"
//   Layout + pages      -> the real app
//
// WHAT IT DOES
// The tenant id is now part of every address, so a curious user can edit it:
//   /company/MY-COMPANY/employees  ->  /company/SOMEONE-ELSE/employees
// When that happens we quietly put them back on their OWN company, keeping the
// page they were trying to reach (…/employees stays …/employees) and anything in
// the query string, so nothing about their work is lost.
//
// WHY WE REDIRECT INSTEAD OF SHOWING AN ERROR
// A mismatch is almost always a stale bookmark or a copied link, not an attack.
// Sending the person to the same page inside their own company is the helpful
// answer, and it never leaks whether the other tenant id actually exists.
//
// THIS IS NOT WHAT PROTECTS THE DATA
// The tenant id in the URL is never sent to the API as a trusted value. The
// backend reads the tenant from the signed-in session and would refuse to return
// another company's employee records even if this check were removed. That is the
// real protection for the health and training data SafeWork holds; this guard only
// keeps the SCREEN honest, so the address bar can always be trusted to say which
// company the records on it belong to.
export default function TenantGuard() {
  // The company id written in the address bar.
  const { tenantId: tenantIdInUrl } = useParams();

  // The company the signed-in user really belongs to. It comes from the central
  // RegulaOne login (GET /api/auth/me) and is mirrored into Redux by AuthContext.
  const userTenantId = useSelector((state) => state.auth.user?.tenantId);

  const location = useLocation();

  // A signed-in user with no company at all cannot have a SafeWork licence, so
  // ModuleAccessGuard above us has normally shown a message already. We repeat the
  // check here so this guard is safe on its own and can never build a broken
  // "/company/undefined/…" address.
  if (!userTenantId) {
    return <AccessRestricted variant={ACCESS.MODULE_UNAVAILABLE} />;
  }

  // The address names a different company than the user's own -> move them back.
  if (tenantIdInUrl !== userTenantId) {
    // Keep everything after "/company/{id}" — that is the page they wanted.
    // "/company/x/employees/12".split("/") -> ["", "company", "x", "employees", "12"]
    // so dropping the first three parts leaves "employees/12". If they named no
    // page at all we send them to their home page.
    const subPage = location.pathname.split("/").slice(3).join("/");

    return (
      <Navigate
        to={`${orgPath(userTenantId, subPage ? `/${subPage}` : HOME_SUBPATH)}${location.search}`}
        replace
      />
    );
  }

  // Right user, right company -> render the app (Layout and the routed page).
  return <Outlet />;
}
