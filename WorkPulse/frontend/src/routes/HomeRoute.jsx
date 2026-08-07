import { Navigate } from "react-router-dom";
import Clock from "../pages/Clock";
import RequireCapability from "./RequireCapability";
import { CAPABILITIES } from "../config/capabilities";
import { useCapabilities } from "../hooks/useCapabilities";
import { useOrgBase } from "../utils/paths";

// What the user sees at "/company/{tenantId}/home" — the first screen after logging
// in, and the page the "Clock" menu item points at.
//
// WHY THIS EXISTS
// The home page used to always be the Clock screen. That works for a worker, for
// HR and for an admin, but NOT for an auditor: an auditor may not clock in (the
// person checking working-time records must not also be producing them), so they
// were dropped straight onto a "this page is not part of your role" message the
// moment they logged in — as if the app were broken for them.
//
// Now the landing screen follows what the person may actually do:
//   - anyone who may clock in         -> the Clock screen, exactly as before
//   - anyone else (today: an auditor) -> their first useful page instead
//
// WHAT CHANGED AND WHY: `path` used to be the whole address ("/dashboard"). It is
// now only the tail, because every page moved under "/company/{tenantId}/…".
// Sending somebody to the old flat "/dashboard" would still work (an old-link
// forwarder catches it), but it would cost an extra redirect on the very first
// screen after login, and the address bar would flicker between two URLs while it
// happened.
const LANDING_FALLBACKS = [
  // Ordered best-first: the Dashboard gives the widest overview, so an auditor
  // starts there rather than in a long table.
  { path: "/dashboard", capability: CAPABILITIES.DASHBOARD_READ },
  { path: "/records", capability: CAPABILITIES.TIME_READ_ALL },
  { path: "/absences", capability: CAPABILITIES.ABSENCE_READ_ALL },
  { path: "/audit-logs", capability: CAPABILITIES.AUDIT_READ },
  { path: "/policy", capability: CAPABILITIES.POLICY_READ },
];

export default function HomeRoute() {
  const { can } = useCapabilities();

  // "/company/{tenantId}" — the fallback page must stay inside the same company.
  const orgBase = useOrgBase();

  // The normal case: this person clocks in and out, so the Clock screen is home.
  if (can(CAPABILITIES.CLOCK_SELF)) return <Clock />;

  // Otherwise send them to the first page their role covers. `replace` keeps the
  // home address out of the browser history, so the Back button does not bounce
  // them through this redirect again.
  const target = LANDING_FALLBACKS.find((item) => can(item.capability));
  if (target) return <Navigate to={`${orgBase}${target.path}`} replace />;

  // A recognised WorkPulse user with no page at all is not something the role table
  // can currently produce, but if it ever happens we show the same clear message as
  // every other blocked page instead of an empty screen.
  return <RequireCapability capability={CAPABILITIES.CLOCK_SELF} />;
}
