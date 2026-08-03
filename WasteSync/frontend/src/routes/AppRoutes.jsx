import { createBrowserRouter } from "react-router-dom";

import Layout from "../components/layout/Layout";
import Login from "../components/Login";
import SsoCallback from "../components/SsoCallback";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import ModuleAccessGuard from "./ModuleAccessGuard";
import RequireCapability from "./RequireCapability";
import HomeRoute from "./HomeRoute";
import { CAPABILITIES } from "../config/capabilities";

import Companies from "../pages/Companies";
import CompanyForm from "../pages/CompanyForm";
import WasteEntries from "../pages/WasteEntries";
import Reports from "../pages/Reports";
import ReportDetail from "../pages/ReportDetail";
import Thresholds from "../pages/Thresholds";
import AuditLogs from "../pages/AuditLogs";
import NotFound from "../pages/NotFound";

const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [{ path: "/login", element: <Login /> }],
  },
  {
    // SSO callback — where the central RegulaOne login returns the user to.
    path: "/auth/sso-callback",
    element: <SsoCallback />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        // ModuleAccessGuard sits between "is logged in" (ProtectedRoute) and the
        // real app (Layout). It blocks users whose account is switched off, whose
        // tenant has no WasteSync licence, whose plan has expired, or who were
        // never given WasteSync themselves.
        element: <ModuleAccessGuard />,
        children: [
          {
            path: "/",
            element: <Layout />,
            children: [
              // ── Pages gated by what the user's role may DO ──────────────────
              // Each page below is wrapped in RequireCapability, which shows a
              // short "not part of your role" message instead of letting the page
              // load and fill up with failed requests. The rules come from
              // config/capabilities.js, and the backend enforces the same rules on
              // every API call — the browser check is only for a tidy screen.

              // The landing page picks the first screen the user's role covers,
              // so nobody is dropped onto a blocked page right after logging in.
              { index: true, element: <HomeRoute /> },

              {
                // Viewing the companies we report waste for.
                element: <RequireCapability capability={CAPABILITIES.COMPANY_READ} />,
                children: [{ path: "companies", element: <Companies /> }],
              },
              {
                // Adding or editing a company is a write, so auditors cannot open
                // these two pages at all.
                element: <RequireCapability capability={CAPABILITIES.COMPANY_WRITE} />,
                children: [
                  { path: "companies/new", element: <CompanyForm /> },
                  { path: "companies/:id/edit", element: <CompanyForm /> },
                ],
              },
              {
                // The waste figures page shows the 12-month grid to everyone who may
                // read it; the "record / correct a month" form inside it is hidden
                // separately for people without WASTE_ENTRY_WRITE.
                element: <RequireCapability capability={CAPABILITIES.WASTE_ENTRY_READ} />,
                children: [{ path: "waste-entries", element: <WasteEntries /> }],
              },
              {
                // Reports list + one report. The "Generate" button and the "Mark
                // submitted" button inside these pages are gated on their own.
                element: <RequireCapability capability={CAPABILITIES.REPORT_READ} />,
                children: [
                  { path: "reports", element: <Reports /> },
                  { path: "reports/:id", element: <ReportDetail /> },
                ],
              },
              {
                // Everyone who uses WasteSync may READ the legal limits, because a
                // report cannot be understood without them. The page itself turns
                // its inputs read-only for anyone without THRESHOLD_WRITE.
                element: <RequireCapability capability={CAPABILITIES.THRESHOLD_READ} />,
                children: [{ path: "thresholds", element: <Thresholds /> }],
              },
              {
                // Only admins and auditors may read the audit trail. HR is excluded
                // on purpose: it would let HR see which colleagues opened or
                // corrected whose figures, which is staff surveillance with no work
                // reason behind it.
                element: <RequireCapability capability={CAPABILITIES.AUDIT_READ} />,
                children: [{ path: "audit-logs", element: <AuditLogs /> }],
              },

              { path: "*", element: <NotFound /> },
            ],
          },
        ],
      },
    ],
  },
]);

export default router;
