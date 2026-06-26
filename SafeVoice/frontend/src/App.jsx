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
    <div className="bg-slate-50 text-slate-900 font-sans min-h-screen flex antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:bg-cyan-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
      >
        Skip to content
      </a>

      <AppSidebar
        currentPath={currentPath}
        navigate={navigate}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <div className="flex-grow flex flex-col min-h-screen overflow-x-hidden">
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

        <main id="main-content" className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20">
          {page}
        </main>
      </div>
    </div>
  );
}
