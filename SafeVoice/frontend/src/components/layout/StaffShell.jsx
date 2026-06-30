/**
 * StaffShell — the authenticated workspace chrome (sidebar + navbar + mobile menu)
 * wrapped around every staff page by the SSO AuthGate. All SSO session logic lives
 * here, so it ONLY runs in the staff world — the public/anonymous pages never mount
 * it and therefore never touch a session (an anonymity requirement).
 */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { AppNavbar } from "./AppNavbar";
import { AppSidebar } from "./AppSidebar";
import { MobileNavigation } from "./MobileNavigation";
import { AuthGate } from "../auth";
import { tryRefreshSession } from "../../services/api";
import { socketService } from "../../services/socketService";
import { normalizeReport } from "../../services/caseNormalizer";
import {
  initSession,
  signOut,
  ssoLoopDetected,
  selectAuthStatus,
  selectCurrentUser,
  selectIsAuthenticated,
} from "../../slices/authSlice";
import { caseReceived } from "../../slices/reportsSlice";
import { addToast } from "../../slices/uiSlice";
import { isStaffSection, toBrowserPath } from "../../utils/routing";

const SSO_CALLBACK_PATH = "/auth/sso-callback";

export function StaffShell({ currentPath, navigate, children }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const status = useSelector(selectAuthStatus);
  const user = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const tenantId = user?.tenantId ?? "";

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Verify the SSO session. We only kick it off when it has not run yet ("idle")
  // so /api/auth/me is called at most once for the whole app — the landing page may
  // already have verified it, in which case we reuse that cached result. The
  // AuthGate's "Try again" still works because the thunk allows a manual re-check.
  useEffect(() => {
    if (status === "idle") dispatch(initSession());
  }, [dispatch, status]);

  // Endless-redirect-loop guard from services/api.js.
  useEffect(() => {
    const onLoop = () => dispatch(ssoLoopDetected());
    window.addEventListener("safevoice:sso-loop", onLoop);
    return () => window.removeEventListener("safevoice:sso-loop", onLoop);
  }, [dispatch]);

  // Silent token refresh every 55 minutes while signed in.
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setInterval(() => tryRefreshSession(), 55 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  // Open the realtime (WebSocket) connection once the staff session is verified, and close
  // it on sign-out. Auth uses the shared SSO cookie (sent automatically on the handshake).
  //
  // While connected we listen on this organisation's case feed, so whenever a new report is
  // submitted anywhere in the tenant we (a) drop it into the Cases list + Inbox live and
  // (b) show a notification — no matter which page the user is on. The backend only lets us
  // listen to our OWN tenant's feed, so we never hear another organisation's reports.
  useEffect(() => {
    if (!isAuthenticated || !tenantId) return undefined;
    socketService.connectStaff();
    const unsubscribe = socketService.subscribe(`/topic/tenant.${tenantId}.cases`, (frame) => {
      let summary;
      try {
        summary = normalizeReport(JSON.parse(frame.body));
      } catch {
        return;
      }
      if (!summary?.id) return;
      dispatch(caseReceived(summary));
      dispatch(
        addToast({
          type: "info",
          message: t("cases.newReport", { ref: summary.caseReference || summary.id }),
          // Keep new-report notifications on screen until the user dismisses them.
          persistent: true,
        }),
      );
    });
    return () => {
      unsubscribe();
      socketService.disconnect();
    };
  }, [isAuthenticated, tenantId, dispatch, t]);

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

  // The whole staff chrome (sidebar + navbar + content) is wrapped in <AuthGate>.
  // Until the session is verified AND the user is allowed into SafeVoice, AuthGate
  // renders only its own full-screen state (spinner / login redirect / access modal)
  // and the chrome below is NEVER mounted — so an unauthenticated or blocked visitor
  // never even sees the navigation. This matches KSeFFlow's ProtectedRoute → Workspace.
  return (
    <AuthGate>
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
            <div className="p-4 md:p-6 lg:p-8 w-full mx-auto flex-1">{children}</div>
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
