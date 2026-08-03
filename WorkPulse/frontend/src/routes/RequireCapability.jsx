import { Outlet } from "react-router-dom";
import { useCapabilities } from "../hooks/useCapabilities";
import AccessRestricted from "../pages/AccessRestricted";
import { ACCESS } from "../config/moduleAccess";

// Page-level check: "may this user open THIS page at all?"
//
// ProtectedRoute already answered "are you logged in?", and ModuleAccessGuard
// answered the bigger questions (is your account active, is WorkPulse in your
// package, is the plan paid, were you given WorkPulse at all). This guard answers
// the last one: does this page match what your role may do?
//
// Example: an auditor may read every time record but must never see the Clock
// screen, because they do not clock in — and a normal employee must never open the
// Dashboard, which shows other people's hours. Wrapping those routes here means the
// person gets one short message instead of a page that fills with errors.
//
// Usage in the router:
//   {
//     element: <RequireCapability capability={CAPABILITIES.DASHBOARD_READ} />,
//     children: [{ path: "dashboard", element: <Dashboard /> }],
//   }
//
// Pass `capability` for one requirement, or `anyOf` for "any one of these" — used
// by pages that serve two audiences, such as Settlement (your own balance, or the
// whole tenant's report).
//
// This is about showing the right screen, not about security: every API call the
// page would make is checked again by the backend, which is what actually protects
// the data.
export default function RequireCapability({ capability, anyOf, children }) {
  const { can } = useCapabilities();

  const required = anyOf?.length ? anyOf : [capability].filter(Boolean);

  // A guard that requires nothing would let everyone in — exactly the kind of
  // quiet mistake we want to avoid — so treat it as "not allowed".
  const allowed = required.length > 0 && required.some((item) => can(item));

  if (!allowed) {
    // A different message from "you have no WorkPulse access": this user DOES use
    // WorkPulse, just not this particular page. We render the shared
    // AccessRestricted page so all five refusal messages in the app look the
    // same, instead of this one having its own hand-built layout.
    return <AccessRestricted variant={ACCESS.PAGE_NOT_PERMITTED} />;
  }

  // `children` is used when wrapping a single element; `Outlet` when this guard is
  // a parent route in the router.
  return children ?? <Outlet />;
}
