import { createBrowserRouter, Navigate } from "react-router-dom";

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
import TenantGuard from "./TenantGuard";
import TenantRedirect from "./TenantRedirect";
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
            // ── Every signed-in page lives under /company/{tenantId}/… ──────
            //
            // WHAT CHANGED AND WHY
            // The pages used to sit at flat addresses ("/employees", "/reports").
            // They now sit under the company they belong to, so the address bar
            // always says WHOSE staff records are on screen — the same URL shape
            // the other RegulaOne apps already use. SafeWork holds medical
            // certificates and BHP training records, so "which company was this?"
            // must be answerable from a screenshot or a pasted link months later.
            //
            // The tenant id shown here comes from the central login
            // (GET /api/auth/me). It is NOT sent to the API as a trusted value:
            // the backend takes the tenant from the session and ignores the
            // browser, because anything in an address bar can be typed by hand.
            //
            // TenantGuard checks that the company in the address is the user's own
            // and quietly corrects it if somebody edits the id.
            path: "/company/:tenantId",
            element: <TenantGuard />,
            children: [
              {
                element: <Layout />,
                children: [
                  // ── Pages gated by what the user's role may DO ────────────
                  // Each page below is wrapped in RequireCapability, which shows a
                  // short "not part of your role" message instead of letting the
                  // page load and fill up with failed requests. The rules come from
                  // config/capabilities.js, and the backend enforces the same rules
                  // on every API call — the browser check is only for a tidy screen.
                  //
                  // Every `path` below is RELATIVE to "/company/:tenantId", so
                  // "employees" is really "/company/{tenantId}/employees".
                  {
                    element: <RequireCapability capability={CAPABILITIES.DASHBOARD_READ} />,
                    children: [
                      // ── The home page ("/company/{tenantId}/home") ──────────
                      //
                      // WHAT CHANGED AND WHY: this screen used to be the NAMELESS
                      // page at "/" (an "index" route). It now has a real name,
                      // "home". A page with no name of its own cannot be linked to
                      // from the menu like the others, cannot be bookmarked on its
                      // own, and is awkward to name in a support ticket.
                      //
                      // The page itself is unchanged — it is the same compliance
                      // dashboard that used to answer at "/".
                      { path: "home", element: <Dashboard /> },

                      // Unchanged: the marketing-style overview page.
                      { path: "dashboard", element: <Home /> },
                    ],
                  },
                  {
                    // Viewing employee records (list + single profile).
                    element: <RequireCapability capability={CAPABILITIES.EMPLOYEE_READ} />,
                    children: [
                      { path: "employees", element: <EmployeeList /> },
                      // These paths lost their leading "/" on purpose. An absolute
                      // path here would have meant the real "/employees/:id" at the
                      // top of the site, jumping OUT of the company address; a
                      // relative one stays inside "/company/{tenantId}".
                      { path: "employees/:id", element: <EmployeeProfile /> },
                    ],
                  },
                  {
                    // Creating an employee profile is a write, so auditors cannot open it.
                    element: <RequireCapability capability={CAPABILITIES.EMPLOYEE_WRITE} />,
                    children: [{ path: "employees/add", element: <AddEmployee /> }],
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

                  { path: "reports", element: <Placeholder /> },
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

                  // The bare company address still works: "/company/{tenantId}"
                  // forwards to "/company/{tenantId}/home". Old links and anyone who
                  // trims the address by hand still land in the right place. The
                  // address is relative on purpose — it keeps whatever tenant id is
                  // already in the URL, which TenantGuard has already checked.
                  { index: true, element: <Navigate to="home" replace /> },

                  // An unknown page INSIDE the company, e.g. /company/{id}/nope.
                  { path: "*", element: <Placeholder /> },
                ],
              },
            ],
          },

          // The app root: "/" -> "/company/{tenantId}/home".
          { path: "/", element: <TenantRedirect /> },

          // Anything else that is not a company address yet. This is what keeps the
          // OLD flat links alive: "/employees/12" becomes
          // "/company/{tenantId}/employees/12" instead of "page not found", so saved
          // bookmarks and links inside old e-mails still open the right page.
          { path: "*", element: <TenantRedirect /> },
        ],
      },
    ],
  },
]);

export default router;