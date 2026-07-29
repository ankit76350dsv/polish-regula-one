import { createBrowserRouter } from "react-router-dom";

import Layout from "../components/layout/Layout";
import Home from "../pages/Home";
import Dashboard from "../pages/Dashboard";
import Placeholder from "../pages/Placeholder";
import Login from "../components/Login";
import SsoCallback from "../components/SsoCallback";

import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import ModuleAccessGuard from "./ModuleAccessGuard";
import RequireCapability from "./RequireCapability";
import { CAPABILITIES } from "../config/capabilities";
import EmployeeList from "../components/EmployeeList";
import AddEmployee from "../components/AddEmployee";
import EmployeeProfile from "../components/EmployeeProfile";
import AuditReport from "../components/AuditReport";

const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      {
        path: "/login",
        element: <Login />,
      },
    ],
  },
  {
    // SSO callback — where the central RegulaOne login sends the user back to.
    // It is a standalone route (not Public/Protected) because the component
    // itself decides where to go once the session check finishes.
    path: "/auth/sso-callback",
    element: <SsoCallback />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        // ModuleAccessGuard sits between "is logged in" (ProtectedRoute) and the
        // real app (Layout). It blocks users whose tenant has no SafeWork
        // licence or whose subscription plan has expired.
        element: <ModuleAccessGuard />,
        children: [
      {
        path: "/",
        element: <Layout />,
        children: [
          // ── Pages gated by what the user's role may DO ────────────────────
          // Each page below is wrapped in RequireCapability, which shows a short
          // "not part of your role" message instead of letting the page load and
          // fill up with failed requests. The rules come from
          // config/capabilities.js, and the backend enforces the same rules on
          // every API call — the browser check is only for a tidy screen.
          {
            element: <RequireCapability capability={CAPABILITIES.DASHBOARD_READ} />,
            children: [
              { index: true, element: <Dashboard /> },
              { path: "dashboard", element: <Home /> },
            ],
          },
          {
            // Viewing employee records (list + single profile).
            element: <RequireCapability capability={CAPABILITIES.EMPLOYEE_READ} />,
            children: [
              { path: "employees", element: <EmployeeList /> },
              { path: "/employees/:id", element: <EmployeeProfile /> },
            ],
          },
          {
            // Creating an employee profile is a write, so auditors cannot open it.
            element: <RequireCapability capability={CAPABILITIES.EMPLOYEE_WRITE} />,
            children: [{ path: "/employees/add", element: <AddEmployee /> }],
          },
          { path: "services", element: <Placeholder /> },
          { path: "services/compliance-audits", element: <Placeholder /> },
          { path: "services/risk-assessment", element: <Placeholder /> },
          { path: "services/safety-training", element: <Placeholder /> },
          { path: "services/incident-management", element: <Placeholder /> },

          { path: "solutions", element: <Placeholder /> },
          { path: "solutions/enterprise", element: <Placeholder /> },
          { path: "solutions/smb", element: <Placeholder /> },
          { path: "solutions/construction", element: <Placeholder /> },

          { path: "reports",    element: <Placeholder /> },
          {
            // Only admins and auditors may read the audit trail. HR is excluded
            // on purpose: it would let HR see which colleagues opened whose
            // records, which is staff surveillance with no work reason.
            element: <RequireCapability capability={CAPABILITIES.AUDIT_READ} />,
            children: [{ path: "audit-logs", element: <AuditReport /> }],
          },
          { path: "contact", element: <Placeholder /> },
          { path: "privacy", element: <Placeholder /> },
          { path: "terms", element: <Placeholder /> },

          { path: "*", element: <Placeholder /> },
        ],
      },
        ],
      },
    ],
  },
]);

export default router;