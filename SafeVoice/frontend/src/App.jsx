import { useEffect, useMemo, useState } from "react";
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

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/report";
  return pathname;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path) => {
    const nextPath = normalizePath(path);
    window.history.pushState(null, "", nextPath);
    setCurrentPath(nextPath);
  };

  const page = useMemo(() => {
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
  }, [currentPath]);

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
          />
          <MobileNavigation
            currentPath={currentPath}
            navigate={navigate}
            open={mobileOpen}
            close={() => setMobileOpen(false)}
          />
        </div>

        {/* This is the ONLY part that scrolls. flex-1 makes it take all the
            leftover height, and overflow-y-auto adds a scrollbar only when the
            content is taller than the space available. */}
        <main id="main-content" className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20">
            {page}
          </div>
        </main>
      </div>
    </div>
  );
}
