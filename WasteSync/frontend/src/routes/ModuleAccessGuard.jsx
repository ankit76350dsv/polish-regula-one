import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ACCESS, getModuleAccess } from "../config/moduleAccess";
import AccessRestricted from "../pages/AccessRestricted";

// ModuleAccessGuard runs AFTER ProtectedRoute.
//
// ProtectedRoute only answers "is the user logged in?". This guard answers the
// next question: "is this logged-in user actually allowed to use WasteSync?".
//
// It looks at the user returned by /api/auth/me and:
//   - if WasteSync is NOT in their package -> show the "contact administrator" page
//   - if their subscription plan has expired -> show the "plan expired" page
//   - otherwise -> render the real app (Outlet)
//
// We render the block page in-place (we do NOT redirect to another URL). This
// keeps the logic simple and means there is no extra route a user could visit
// to sneak past the check.
export default function ModuleAccessGuard() {
  const { user } = useAuth();

  // Decide the user's access level using the single shared rule.
  const access = getModuleAccess(user);

  // Tenant has no WasteSync licence -> ask them to contact their administrator.
  if (access === ACCESS.MODULE_UNAVAILABLE) {
    return <AccessRestricted variant={ACCESS.MODULE_UNAVAILABLE} />;
  }

  // Subscription plan has expired -> ask them to renew.
  if (access === ACCESS.PLAN_EXPIRED) {
    return <AccessRestricted variant={ACCESS.PLAN_EXPIRED} />;
  }

  // Everything is fine -> let the app render normally.
  return <Outlet />;
}
