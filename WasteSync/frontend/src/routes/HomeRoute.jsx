import { Navigate } from "react-router-dom";
import Dashboard from "../pages/Dashboard";
import RequireCapability from "./RequireCapability";
import { CAPABILITIES } from "../config/capabilities";
import { useCapabilities } from "../hooks/useCapabilities";

// What the user sees at "/" — the first screen after logging in.
//
// WHY THIS EXISTS
// The home page is the Dashboard, and all three WasteSync roles may read it today.
// But the role table lives in one file and is meant to be edited: the moment a role
// is created (or changed) without DASHBOARD_READ, that person would land on a
// "this page is not part of your role" message the second they logged in — as if
// the app were broken for them.
//
// So instead of assuming, we ask: show the Dashboard to anyone who may read it, and
// send everybody else to the first page their role DOES cover.
const LANDING_FALLBACKS = [
  // Ordered best-first: the reports list is the closest thing to an overview,
  // then the raw figures, then the audit trail.
  { path: "/reports", capability: CAPABILITIES.REPORT_READ },
  { path: "/waste-entries", capability: CAPABILITIES.WASTE_ENTRY_READ },
  { path: "/companies", capability: CAPABILITIES.COMPANY_READ },
  { path: "/audit-logs", capability: CAPABILITIES.AUDIT_READ },
  { path: "/thresholds", capability: CAPABILITIES.THRESHOLD_READ },
];

export default function HomeRoute() {
  const { can } = useCapabilities();

  // The normal case for every role we ship today.
  if (can(CAPABILITIES.DASHBOARD_READ)) return <Dashboard />;

  // Otherwise send them to the first page their role covers. `replace` keeps the
  // empty "/" out of the browser history, so the Back button does not bounce them
  // through this redirect again.
  const target = LANDING_FALLBACKS.find((item) => can(item.capability));
  if (target) return <Navigate to={target.path} replace />;

  // A recognised WasteSync user with no page at all is not something the role table
  // can currently produce, but if it ever happens we show the same clear message as
  // every other blocked page instead of an empty screen.
  return <RequireCapability capability={CAPABILITIES.DASHBOARD_READ} />;
}
