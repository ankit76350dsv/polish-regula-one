import { createBrowserRouter, Navigate } from "react-router-dom";

import Layout from "../components/layout/Layout";
import Login from "../components/Login";
import SsoCallback from "../components/SsoCallback";

import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import ModuleAccessGuard from "./ModuleAccessGuard";
import RequireCapability from "./RequireCapability";
import HomeRoute from "./HomeRoute";
import TenantGuard from "./TenantGuard";
import TenantRedirect from "./TenantRedirect";
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
        // ModuleAccessGuard sits between "is logged in" (ProtectedRoute) and the
        // real app (Layout). It blocks users whose account has been suspended,
        // whose tenant has no WorkPulse licence, whose subscription plan has
        // expired, or who were never granted WorkPulse. Because it wraps the
        // Layout, there is no page — not even a mistyped URL — that can get past
        // it while one of those is true.
        element: <ModuleAccessGuard />,
        children: [
          {
            // ── Every signed-in page lives under /company/{tenantId}/… ──────────
            //
            // WHAT CHANGED AND WHY
            // The pages used to sit at flat addresses ("/records", "/policy").
            // They now sit under the company they belong to, so the address bar
            // always says WHOSE working hours are on screen — the same URL shape
            // the other RegulaOne apps already use (WasteSync, SafeWork). Time
            // records are legal evidence kept for years, so "which company was
            // this?" must be answerable from a screenshot or a pasted link months
            // later, and a person can never correct the wrong company's records
            // because their bookmark was stale.
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
                // ── Pages gated by what the user's role may DO ──────────────────
                // Each page is wrapped in RequireCapability, so typing the address
                // of a page your role does not cover shows one short message
                // instead of a screen full of failed requests. The rules live in
                // config/capabilities.js, and the backend enforces the same rules
                // on every API call — the browser check is only for a tidy screen.
                //
                // Every `path` below is RELATIVE to "/company/:tenantId", so
                // "records" is really "/company/{tenantId}/records".
                children: [
                  // ── The home page ("/company/{tenantId}/home") ────────────────
                  //
                  // WHAT CHANGED AND WHY: home used to be the NAMELESS page at "/"
                  // (an "index" route). It now has a real name, "home". A page with
                  // no name of its own cannot be linked to from the menu like the
                  // others, cannot be bookmarked on its own, and is awkward to name
                  // in a support ticket.
                  //
                  // HomeRoute shows the Clock screen to anyone who may clock in, and
                  // sends everybody else (today: an auditor, who must not clock in)
                  // to the first page their role covers — so nobody lands on a "not
                  // for your role" message straight after logging in.
                  { path: "home", element: <HomeRoute /> },

                  // The bare company address still works: "/company/{tenantId}"
                  // forwards to "/company/{tenantId}/home". Old links and anyone who
                  // trims the address by hand still land in the right place. The
                  // address is relative on purpose — it keeps whatever tenant id is
                  // already in the URL, which TenantGuard above has already checked.
                  { index: true, element: <Navigate to="home" replace /> },

                  {
                    element: <RequireCapability capability={CAPABILITIES.TIME_SELF_READ} />,
                    children: [{ path: "my-timesheet", element: <MyTimesheet /> }],
                  },
                  {
                    // Serves two audiences: a worker asking for leave, and HR
                    // reviewing requests. Either capability is enough to open the
                    // page; what appears inside it still depends on the person.
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
                    // Everyone may READ the working-time norm that applies to them;
                    // only an admin may change it, which the page itself enforces on
                    // its Save button.
                    element: <RequireCapability capability={CAPABILITIES.POLICY_READ} />,
                    children: [{ path: "policy", element: <Policy /> }],
                  },
                  {
                    // Admins and auditors only — HR is excluded on purpose, so HR
                    // cannot watch which colleagues opened whose records.
                    element: <RequireCapability capability={CAPABILITIES.AUDIT_READ} />,
                    children: [{ path: "audit-logs", element: <AuditReport /> }],
                  },

                  // An unknown page INSIDE the company, e.g. /company/{id}/nope.
                  { path: "*", element: <NotFound /> },
                ],
              },
            ],
          },

          // The app root: "/" -> "/company/{tenantId}/home".
          { path: "/", element: <TenantRedirect /> },

          // Anything else that is not a company address yet. This is what keeps the
          // OLD flat links alive: "/records" becomes "/company/{tenantId}/records"
          // instead of "page not found", so saved bookmarks and links inside old
          // e-mails still open the right page. A genuinely wrong address still ends
          // on the NotFound page, because the forwarded address does not match any
          // page inside the company either.
          { path: "*", element: <TenantRedirect /> },
        ],
      },
    ],
  },
]);

export default router;
