import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  AccessDeniedPage,
  AdminDashboardPage,
  CaseDetailsPage,
  CaseManagementPage,
  CentralEncryptedInboxPage,
  ComplianceSettingsPage,
  PublicReportPortal,
  ReportSuccessPage,
  SecurityAuditTrailLogsPage,
  TrackCasePage,
  UsersPermissionsMatrixPage,
} from "./pages";
// The navigation shell (sidebar, top navbar, mobile menu) now lives in its own
// folder so this file only has to wire the pieces together, not define them.
import { AppNavbar, AppSidebar, MobileNavigation } from "./components/layout";
// AuthGate guards the staff area behind the central RegulaOne SSO session.
import { AuthGate } from "./components/auth";
import {
  initSession,
  signOut,
  ssoLoopDetected,
  selectCurrentUser,
  selectIsAuthenticated,
} from "./slices/authSlice";
import { tryRefreshSession } from "./services/api";
// Translates between our short internal paths ("/dashboard") and the address-bar
// URL the signed-in staff area uses ("/company/{tenantId}/dashboard").
import { toLogicalPath, toBrowserPath, isStaffSection } from "./utils/routing";

// The staff area is protected by RegulaOne SSO (isStaffSection in utils/routing).
// The public report-submission and report-tracking routes are deliberately NOT in
// that list — anonymous whistleblowers must reach them without signing in
// (EU 2019/1937 + Poland 2024 Whistleblower Act).

// The path the central login sends the browser back to after a successful sign-in.
const SSO_CALLBACK_PATH = "/auth/sso-callback";

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/report";
  return pathname;
}

// Tiny full-area spinner shown for the brief moment after the central login returns
// us to /auth/sso-callback, before we redirect to the staff dashboard.
function SsoCallbackPending() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 mx-auto border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-600 text-sm font-medium">Completing sign-in…</p>
      </div>
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // The organisation the signed-in staff member belongs to. It namespaces every
  // staff URL as /company/{tenantId}/… . Empty until the SSO session is verified.
  const tenantId = user?.tenantId ?? "";

  // currentPath is always the LOGICAL path ("/dashboard", "/cases/abc"). We read it
  // from the address bar with toLogicalPath so a deep link like
  // /company/T1/cases/abc still resolves to the right screen.
  const [currentPath, setCurrentPath] = useState(() =>
    normalizePath(toLogicalPath(window.location.pathname)),
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () =>
      setCurrentPath(normalizePath(toLogicalPath(window.location.pathname)));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // navigate() accepts either a logical path ("/cases/abc") or a full browser URL
  // ("/company/T1/cases/abc") and does the right thing: it keeps state on the
  // logical path but writes the tenant-prefixed URL to the address bar.
  const navigate = (path) => {
    const logical = normalizePath(toLogicalPath(path));
    const url = toBrowserPath(logical, tenantId);
    window.history.pushState(null, "", url);
    setCurrentPath(logical);
  };

  // ── SSO session bootstrap ─────────────────────────────────────────────────
  // On load, ask the RegulaOne backend whether the shared-domain cookie is a
  // valid session. The result lives in the Redux auth slice and drives AuthGate.
  useEffect(() => {
    dispatch(initSession());
  }, [dispatch]);

  // services/api.js fires this event when a 401 keeps redirecting us in circles;
  // we flip ssoLoop so AuthGate stops reloading and shows an explanation instead.
  useEffect(() => {
    const onLoop = () => dispatch(ssoLoopDetected());
    window.addEventListener("safevoice:sso-loop", onLoop);
    return () => window.removeEventListener("safevoice:sso-loop", onLoop);
  }, [dispatch]);

  // The login token expires after about an hour. While a staff member is signed in
  // we silently refresh it every 55 minutes so they never get bounced to login.
  useEffect(() => {
    if (!isAuthenticated) return;
    const REFRESH_INTERVAL_MS = 55 * 60 * 1000;
    const timer = setInterval(() => {
      tryRefreshSession();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  // After the central login returns us to /auth/sso-callback, send the user on to
  // where they were headed (returnPath) or to the staff dashboard.
  useEffect(() => {
    if (isAuthenticated && currentPath === SSO_CALLBACK_PATH) {
      const params = new URLSearchParams(window.location.search);
      const returnPath = params.get("returnPath");
      navigate(returnPath || "/dashboard");
    }
    // navigate is stable for our purposes; we only react to auth/path changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentPath]);

  // Once signed in, make sure a staff URL carries its /company/{tenantId} prefix.
  // This fixes deep links / refreshes that landed on a flat path (e.g. someone
  // opened /dashboard before logging in): we rewrite it in place to the canonical
  // /company/{tenantId}/dashboard without adding a new history entry.
  useEffect(() => {
    if (!isAuthenticated || !tenantId) return;
    if (currentPath === SSO_CALLBACK_PATH || !isStaffSection(currentPath)) return;
    const canonical = toBrowserPath(currentPath, tenantId);
    if (window.location.pathname !== canonical) {
      window.history.replaceState(null, "", canonical);
    }
  }, [isAuthenticated, tenantId, currentPath]);

  // Sign out: clears the SSO cookies on the backend and leaves for the central app.
  const handleLogout = () => dispatch(signOut());

  // Does the current screen require a verified staff session?
  const gated = currentPath === SSO_CALLBACK_PATH || isStaffSection(currentPath);

  const page = useMemo(() => {
    if (currentPath === SSO_CALLBACK_PATH) return <SsoCallbackPending />;
    if (currentPath === "/report") return <PublicReportPortal />;
    if (currentPath === "/report/success") return <ReportSuccessPage />;
    if (currentPath === "/track") return <TrackCasePage />;
    if (currentPath === "/access-denied") return <AccessDeniedPage navigate={navigate} />;
    if (currentPath === "/dashboard") return <AdminDashboardPage navigate={navigate} />;
    if (currentPath === "/cases") return <CaseManagementPage navigate={navigate} />;
    if (currentPath.startsWith("/cases/")) {
      return <CaseDetailsPage caseId={decodeURIComponent(currentPath.replace("/cases/", ""))} />;
    }
    if (currentPath === "/messages") return <CentralEncryptedInboxPage />;
    if (currentPath === "/audits") return <SecurityAuditTrailLogsPage />;
    if (currentPath === "/users") return <UsersPermissionsMatrixPage />;
    if (currentPath === "/settings") return <ComplianceSettingsPage />;
    return <AccessDeniedPage navigate={navigate} />;
    // tenantId is included so the pages' navigate() closure rebuilds with the
    // correct /company/{tenantId} prefix the moment the session is verified.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, tenantId]);

  return (
    // The whole app is exactly as tall as the screen (h-screen) and hides its
    // own overflow. This means the PAGE never scrolls. Instead, only the main
    // content area below is allowed to scroll, which keeps the sidebar and
    // navbar fixed in place no matter how long the content gets.
    <div className="bg-slate-50 text-slate-900 font-sans h-screen flex overflow-hidden antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:bg-cyan-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
      >
        Skip to content
      </a>

      {/* The sidebar is already full screen height (h-screen) and sits to the
          left. Because the page does not scroll, it stays put on its own. */}
      <AppSidebar
        currentPath={currentPath}
        navigate={navigate}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        user={user}
        onLogout={handleLogout}
        tenantId={tenantId}
      />

      {/* Right column: a vertical stack that fills the remaining width.
          min-w-0 lets wide content shrink instead of pushing the layout wider. */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* shrink-0 keeps the navbar at its natural height so it never gets
            squeezed and never scrolls away. */}
        <div className="shrink-0">
          <AppNavbar
            currentPath={currentPath}
            navigate={navigate}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
            user={user}
            onLogout={handleLogout}
            tenantId={tenantId}
          />
          <MobileNavigation
            currentPath={currentPath}
            navigate={navigate}
            open={mobileOpen}
            close={() => setMobileOpen(false)}
            tenantId={tenantId}
          />
        </div>

        {/* This is the ONLY part that scrolls. flex-1 makes it take all the
            leftover height, and overflow-y-auto adds a scrollbar only when the
            content is taller than the space available. */}
        <main id="main-content" className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20">
            {/* Staff pages (and the SSO callback) run through AuthGate, which shows
                the spinner / login redirect / access modal as needed. Public report
                pages render directly so anonymous reporters are never gated. */}
            {<AuthGate>{page}</AuthGate>}
          </div>
        </main>
      </div>
    </div>
  );
}
