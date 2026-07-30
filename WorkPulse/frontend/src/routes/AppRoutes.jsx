import { createBrowserRouter } from "react-router-dom";

import Layout from "../components/layout/Layout";
import Login from "../components/Login";
import SsoCallback from "../components/SsoCallback";

import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import RequireCapability from "./RequireCapability";
import HomeRoute from "./HomeRoute";
import { CAPABILITIES } from "../config/capabilities";

import MyTimesheet from "../pages/MyTimesheet";
import Absences from "../pages/Absences";
import TimeRecords from "../pages/TimeRecords";
import Dashboard from "../pages/Dashboard";
import Settlement from "../pages/Settlement";
import Policy from "../pages/Policy";
import AuditReport from "../pages/AuditReport";
import NotFound from "../pages/NotFound";

const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [{ path: "/login", element: <Login /> }],
  },
  {
    // SSO callback — where central RegulaOne login returns the user.
    path: "/auth/sso-callback",
    element: <SsoCallback />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <Layout />,
        // ── Pages gated by what the user's role may DO ──────────────────────
        // Each page is wrapped in RequireCapability, so typing the address of a
        // page your role does not cover shows one short message instead of a
        // screen full of failed requests. The rules live in
        // config/capabilities.js, and the backend enforces the same rules on
        // every API call — the browser check is only for a tidy screen.
        children: [
          {
            // The home screen. HomeRoute shows the Clock screen to anyone who may
            // clock in, and sends everybody else (today: an auditor, who must not
            // clock in) to the first page their role covers — so nobody lands on a
            // "not for your role" message straight after logging in.
            index: true,
            element: <HomeRoute />,
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TIME_SELF_READ} />,
            children: [{ path: "my-timesheet", element: <MyTimesheet /> }],
          },
          {
            // Serves two audiences: a worker asking for leave, and HR reviewing
            // requests. Either capability is enough to open the page; what appears
            // inside it still depends on the person.
            element: (
              <RequireCapability
                anyOf={[CAPABILITIES.ABSENCE_SELF, CAPABILITIES.ABSENCE_READ_ALL]}
              />
            ),
            children: [{ path: "absences", element: <Absences /> }],
          },
          {
            // Everyone's time records — management and audit view.
            element: <RequireCapability capability={CAPABILITIES.TIME_READ_ALL} />,
            children: [{ path: "records", element: <TimeRecords /> }],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.DASHBOARD_READ} />,
            children: [{ path: "dashboard", element: <Dashboard /> }],
          },
          {
            // Your own settlement balance, or the whole tenant's report.
            element: (
              <RequireCapability
                anyOf={[CAPABILITIES.SETTLEMENT_SELF_READ, CAPABILITIES.SETTLEMENT_READ_ALL]}
              />
            ),
            children: [{ path: "settlement", element: <Settlement /> }],
          },
          {
            // Everyone may READ the working-time norm that applies to them; only an
            // admin may change it, which the page itself enforces on its Save button.
            element: <RequireCapability capability={CAPABILITIES.POLICY_READ} />,
            children: [{ path: "policy", element: <Policy /> }],
          },
          {
            // Admins and auditors only — HR is excluded on purpose, so HR cannot
            // watch which colleagues opened whose records.
            element: <RequireCapability capability={CAPABILITIES.AUDIT_READ} />,
            children: [{ path: "audit-logs", element: <AuditReport /> }],
          },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default router;
