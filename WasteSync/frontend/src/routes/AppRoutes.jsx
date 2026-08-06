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

import Companies from "../pages/Companies";
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
            // ── Every signed-in page lives under /company/{tenantId}/… ──────────
            //
            // WHAT CHANGED AND WHY
            // The pages used to sit at flat addresses ("/reports", "/thresholds").
            // They now sit under the company they belong to, so the address bar
            // always says WHOSE waste figures are on screen — the same URL shape
            // the other RegulaOne apps already use. Waste reports are filed with a
            // government register, so "which company was this?" must be answerable
            // from a screenshot or a pasted link months later.
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
                  // ── Pages gated by what the user's role may DO ──────────────
                  // Each page below is wrapped in RequireCapability, which shows a
                  // short "not part of your role" message instead of letting the
                  // page load and fill up with failed requests. The rules come from
                  // config/capabilities.js, and the backend enforces the same rules
                  // on every API call — the browser check is only for a tidy screen.
                  //
                  // Every `path` below is RELATIVE to "/company/:tenantId", so
                  // "reports" is really "/company/{tenantId}/reports".

                  // ── The home page ("/company/{tenantId}/home") ──────────────
                  //
                  // WHAT CHANGED AND WHY: the dashboard used to be the NAMELESS
                  // page at "/company/{tenantId}" (an "index" route). It now has a
                  // real name, "home". A page with no name of its own cannot be
                  // linked to from the menu like the others, cannot be bookmarked
                  // on its own, and is awkward to name in a support ticket.
                  //
                  // HomeRoute picks the first screen the user's role covers, so
                  // nobody is dropped onto a blocked page right after logging in.
                  { path: "home", element: <HomeRoute /> },

                  // The bare company address still works: "/company/{tenantId}"
                  // forwards to "/company/{tenantId}/home". Old links and anyone who
                  // trims the address by hand still land in the right place. The
                  // address is relative on purpose — it keeps whatever tenant id is
                  // already in the URL, which TenantGuard above has already checked.
                  { index: true, element: <Navigate to="home" replace /> },

                  {
                    // The company we report waste for. The details are registered in
                    // RegulaOne and only READ here, so one page covers everything and
                    // COMPANY_READ is enough to open it.
                    //
                    // The "companies/new" and "companies/:id/edit" routes were removed
                    // with the add/edit form: a company typed a second time in
                    // WasteSync could disagree with the legal record in RegulaOne, and
                    // those details are printed on reports filed with a government
                    // register. The one field this page can still change (the BDO
                    // number) is guarded inside the page by COMPANY_WRITE.
                    element: <RequireCapability capability={CAPABILITIES.COMPANY_READ} />,
                    children: [{ path: "companies", element: <Companies /> }],
                  },
                  {
                    // The waste figures page shows the 12-month grid to everyone who
                    // may read it; the "record / correct a month" form inside it is
                    // hidden separately for people without WASTE_ENTRY_WRITE.
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

                  // An unknown page INSIDE the company, e.g. /company/{id}/nope.
                  { path: "*", element: <NotFound /> },
                ],
              },
            ],
          },

          // The app root: "/" -> "/company/{tenantId}" (the dashboard).
          { path: "/", element: <TenantRedirect /> },

          // Anything else that is not a company address yet. This is what keeps the
          // OLD flat links alive: "/reports/123" becomes
          // "/company/{tenantId}/reports/123" instead of "page not found", so saved
          // bookmarks and links inside old e-mails still open the right page.
          // A genuinely wrong address still ends on the NotFound page, because the
          // forwarded address does not match any page inside the company either.
          { path: "*", element: <TenantRedirect /> },
        ],
      },
    ],
  },
]);

export default router;
