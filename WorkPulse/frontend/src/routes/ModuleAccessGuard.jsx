import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ACCESS, getModuleAccess } from "../config/moduleAccess";
import AccessRestricted from "../pages/AccessRestricted";

// ModuleAccessGuard runs AFTER ProtectedRoute.
//
// ProtectedRoute only answers "is the user logged in?". This guard answers the
// next question: "is this logged-in user actually allowed to use WorkPulse?".
//
// It looks at the user returned by /api/auth/me and:
//   - if the account has been switched off       -> show the "suspended" page
//   - if WorkPulse is NOT in their package       -> show the "contact administrator" page
//   - if their subscription plan has expired     -> show the "plan expired" page
//   - if they were never granted WorkPulse       -> show the "permission required" page
//   - otherwise                                  -> render the real app (Outlet)
//
// We render the block page in-place (we do NOT redirect to another URL). This
// keeps the logic simple and means there is no extra route a user could visit
// to sneak past the check.
//
// Mirrors safeWork/frontend/src/routes/ModuleAccessGuard.jsx.
export default function ModuleAccessGuard() {
  const { user } = useAuth();

  // Decide the user's access level using the single shared rule.
  const access = getModuleAccess(user);

  // The account itself has been switched off by an administrator
  // (/me returned "enabled": false). Checked first, because nothing else matters
  // if the account is suspended.
  if (access === ACCESS.ACCOUNT_SUSPENDED) {
    return <AccessRestricted variant={ACCESS.ACCOUNT_SUSPENDED} />;
  }

  // Tenant has no WorkPulse licence -> ask them to contact their administrator.
  if (access === ACCESS.MODULE_UNAVAILABLE) {
    return <AccessRestricted variant={ACCESS.MODULE_UNAVAILABLE} />;
  }

  // Subscription plan has expired -> ask them to renew.
  if (access === ACCESS.PLAN_EXPIRED) {
    return <AccessRestricted variant={ACCESS.PLAN_EXPIRED} />;
  }

  // The company has WorkPulse, but this particular user was not given permission
  // to use it. Every WorkPulse API would answer 403 for them, so we show one
  // clear message instead of letting every page fail on its own.
  if (access === ACCESS.PERMISSION_DENIED) {
    return <AccessRestricted variant={ACCESS.PERMISSION_DENIED} />;
  }

  // Everything is fine -> let the app render normally.
  return <Outlet />;
}
