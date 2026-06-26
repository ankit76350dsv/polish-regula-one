/**
 * StaffShell — the authenticated workspace chrome (sidebar + navbar + mobile menu)
 * wrapped around every staff page by the SSO AuthGate. All SSO session logic lives
 * here, so it ONLY runs in the staff world — the public/anonymous pages never mount
 * it and therefore never touch a session (an anonymity requirement).
 */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppNavbar } from "./AppNavbar";
import { AppSidebar } from "./AppSidebar";
import { MobileNavigation } from "./MobileNavigation";
import { SiteFooter } from "./SiteFooter";
import { AuthGate } from "../auth";
import { USE_MOCK } from "../../config";
import { tryRefreshSession } from "../../services/api";
import { initSession, signOut, ssoLoopDetected, selectCurrentUser, selectIsAuthenticated } from "../../slices/authSlice";
import { isStaffSection, toBrowserPath } from "../../utils/routing";

const SSO_CALLBACK_PATH = "/auth/sso-callback";

export function StaffShell({ currentPath, navigate, children }) {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const tenantId = user?.tenantId ?? "";

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Verify the SSO session once on entering the staff world.
  useEffect(() => {
    dispatch(initSession());
  }, [dispatch]);

  // Endless-redirect-loop guard from services/api.js.
  useEffect(() => {
    const onLoop = () => dispatch(ssoLoopDetected());
    window.addEventListener("safevoice:sso-loop", onLoop);
    return () => window.removeEventListener("safevoice:sso-loop", onLoop);
  }, [dispatch]);

  // Silent token refresh every 55 minutes while signed in (real backend only).
  useEffect(() => {
    if (!isAuthenticated || USE_MOCK) return;
    const timer = setInterval(() => tryRefreshSession(), 55 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  // After the central login returns to /auth/sso-callback, continue to the target.
  useEffect(() => {
    if (isAuthenticated && currentPath === SSO_CALLBACK_PATH) {
      const params = new URLSearchParams(window.location.search);
      const returnPath = params.get("returnPath");
      // Only honour an internal path (must start with "/", no scheme/host).
      const safe = returnPath && /^\/[^/]/.test(returnPath) ? returnPath : "/dashboard";
      navigate(safe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentPath]);

  // Keep a staff URL carrying its /company/{tenantId} prefix after deep link/refresh.
  useEffect(() => {
    if (!isAuthenticated || !tenantId) return;
    if (currentPath === SSO_CALLBACK_PATH || !isStaffSection(currentPath)) return;
    const canonical = toBrowserPath(currentPath, tenantId);
    if (window.location.pathname !== canonical) {
      window.history.replaceState(null, "", canonical);
    }
  }, [isAuthenticated, tenantId, currentPath]);

  const handleLogout = () => dispatch(signOut());

  return (
    <div className="bg-slate-50 text-slate-900 font-sans h-screen flex overflow-hidden antialiased">
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
        user={user}
        onLogout={handleLogout}
        tenantId={tenantId}
      />

      <div className="flex-1 flex flex-col min-w-0">
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
          <MobileNavigation currentPath={currentPath} navigate={navigate} open={mobileOpen} close={() => setMobileOpen(false)} tenantId={tenantId} user={user} />
        </div>

        <main id="main-content" className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-4 md:p-6 lg:p-8 w-full mx-auto flex-1">
            <AuthGate>{children}</AuthGate>
          </div>
          <SiteFooter navigate={navigate} />
        </main>
      </div>
    </div>
  );
}
