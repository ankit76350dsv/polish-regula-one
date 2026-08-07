import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { ACCESS } from "../config/moduleAccess";
import AccessRestricted from "../pages/AccessRestricted";
import { HOME_SUBPATH, orgPath } from "../utils/paths";

// TenantRedirect turns an address WITHOUT a company id into one WITH it.
//
// It answers two situations:
//
//   1. The app root:          "/"              -> "/company/{tenantId}/home"
//   2. An old flat bookmark:  "/records"       -> "/company/{tenantId}/records"
//
// WHY CASE 2 EXISTS (BACKWARD COMPATIBILITY)
// Before this change every page lived at a flat address like "/records". People
// have those links saved in bookmarks, e-mails and support tickets. Letting them
// land on "page not found" would look like the app had broken, so instead we
// forward them to the same page inside their own company. Old links keep working
// and slowly turn into new ones, because `replace` rewrites the address bar.
export default function TenantRedirect() {
  // The company of the signed-in user, taken from GET /api/auth/me (via Redux).
  const userTenantId = useSelector((state) => state.auth.user?.tenantId);
  const location = useLocation();

  // Without a company we cannot build a tenant address. ModuleAccessGuard above us
  // normally catches this first; this is the safety net so we never send the user
  // to "/company/undefined".
  if (!userTenantId) {
    return <AccessRestricted variant={ACCESS.MODULE_UNAVAILABLE} />;
  }

  const path = location.pathname;

  // Work out what to keep from the old address.
  //   "/"        -> keep nothing, land on the home page.
  //   "/company" -> a half-typed tenant address; the id is missing, so we also just
  //                 send them home.
  const isRoot = path === "/";
  const isBareCompanyPath = path === "/company" || path === "/company/";
  const subPage = isRoot || isBareCompanyPath ? HOME_SUBPATH : path;

  // Keep the query string (month filters, and so on) so a shared link still opens
  // the same view the sender was looking at.
  return <Navigate to={`${orgPath(userTenantId, subPage)}${location.search}`} replace />;
}
