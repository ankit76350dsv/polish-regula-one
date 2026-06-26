import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  AccessDeniedPage,
  AdminDashboardPage,
  CaseDetailsPage,
  CaseManagementPage,
  CentralEncryptedInboxPage,
  ComplianceSettingsPage,
  NotFoundPage,
  PublicReportPortal,
  ReportSuccessPage,
  SecurityAuditTrailLogsPage,
  TrackCasePage,
  UsersPermissionsMatrixPage,
} from "./pages";
import {
  AccessibilityPage,
  CookiePolicyPage,
  DataRequestPage,
  ExternalReportingPage,
  HowItWorksPage,
  PrivacyNoticePage,
  TermsPage,
} from "./pages/legal";
import { PublicLayout, StaffShell } from "./components/layout";
import { ToastHost } from "./components/ui";
import { CookieBanner } from "./components/compliance/CookieBanner";
import { selectCurrentUser } from "./slices/authSlice";
import { selectTheme } from "./slices/uiSlice";
import {
  getStandaloneReportTenant,
  isStaffSection,
  toBrowserPath,
  toLogicalPath,
} from "./utils/routing";

const SSO_CALLBACK_PATH = "/auth/sso-callback";

// Public paths anyone may reach with no login. Everything else is treated as the
// gated staff world (and unknown paths fall through to a public 404).
const PUBLIC_PATHS = new Set([
  "/report",
  "/report/success",
  "/track",
  "/privacy",
  "/terms",
  "/cookies",
  "/accessibility",
  "/how-it-works",
  "/external-reporting",
  "/data-request",
]);

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/report";
  return pathname;
}

// Brief spinner shown right after the central login returns to /auth/sso-callback.
function SsoCallbackPending() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 mx-auto border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-600 text-sm font-medium">{t("auth.verifying")}</p>
      </div>
    </div>
  );
}

// Document <title> per route, so browser history/tabs are meaningful.
const TITLE_KEYS = {
  "/report": "report.title",
  "/report/success": "success.title",
  "/track": "track.title",
  "/privacy": "footer.privacy",
  "/terms": "footer.terms",
  "/cookies": "footer.cookies",
  "/accessibility": "footer.accessibility",
  "/how-it-works": "footer.howItWorks",
  "/external-reporting": "footer.externalReporting",
  "/data-request": "compliance.dataRequest.title",
  "/dashboard": "nav.dashboard",
  "/cases": "nav.cases",
  "/messages": "nav.inbox",
  "/audits": "nav.audit",
  "/users": "nav.users",
  "/settings": "nav.settings",
};

export default function App() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const theme = useSelector(selectTheme);
  const user = useSelector(selectCurrentUser);
  const tenantId = user?.tenantId ?? "";

  // Apply the chosen theme to <html> (drives all dark: styles + the dark remap).
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  // ── Router state ──────────────────────────────────────────────────────────
  const standaloneReportTenant = getStandaloneReportTenant(window.location.pathname);

  const [currentPath, setCurrentPath] = useState(() =>
    normalizePath(toLogicalPath(window.location.pathname)),
  );

  useEffect(() => {
    const onPop = () => setCurrentPath(normalizePath(toLogicalPath(window.location.pathname)));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // navigate() accepts a logical path and writes the correct address-bar URL.
  const navigate = (path) => {
    const logical = normalizePath(toLogicalPath(path));
    const url = toBrowserPath(logical, tenantId);
    window.history.pushState(null, "", url);
    setCurrentPath(logical);
    // Scroll back to top on navigation (long pages otherwise keep their scroll).
    window.scrollTo?.(0, 0);
  };

  // Keep the document title in sync with the current route.
  useEffect(() => {
    const key = TITLE_KEYS[currentPath] || (currentPath.startsWith("/cases/") ? "nav.cases" : null);
    document.title = key ? `${t(key)} · SafeVoice` : "SafeVoice";
  }, [currentPath, t]);

  // Resolve the page + which "world" (chrome) it belongs in.
  const { element, world } = useMemo(() => {
    // Standalone anonymous report deep link: /company/{tenantId}/report
    if (standaloneReportTenant) {
      return { element: <PublicReportPortal tenantId={standaloneReportTenant} navigate={navigate} />, world: "public" };
    }

    // Public, no-login pages.
    if (PUBLIC_PATHS.has(currentPath)) {
      const map = {
        "/report": <PublicReportPortal navigate={navigate} />,
        "/report/success": <ReportSuccessPage navigate={navigate} />,
        "/track": <TrackCasePage navigate={navigate} />,
        "/privacy": <PrivacyNoticePage navigate={navigate} />,
        "/terms": <TermsPage navigate={navigate} />,
        "/cookies": <CookiePolicyPage navigate={navigate} />,
        "/accessibility": <AccessibilityPage navigate={navigate} />,
        "/how-it-works": <HowItWorksPage navigate={navigate} />,
        "/external-reporting": <ExternalReportingPage navigate={navigate} />,
        "/data-request": <DataRequestPage navigate={navigate} />,
      };
      return { element: map[currentPath], world: "public" };
    }

    // SSO callback (staff world).
    if (currentPath === SSO_CALLBACK_PATH) return { element: <SsoCallbackPending />, world: "staff" };

    // Gated staff pages.
    if (currentPath === "/dashboard") return { element: <AdminDashboardPage navigate={navigate} />, world: "staff" };
    if (currentPath === "/cases") return { element: <CaseManagementPage navigate={navigate} />, world: "staff" };
    if (currentPath.startsWith("/cases/")) {
      const caseId = decodeURIComponent(currentPath.replace("/cases/", ""));
      return { element: <CaseDetailsPage caseId={caseId} navigate={navigate} />, world: "staff" };
    }
    if (currentPath === "/messages") return { element: <CentralEncryptedInboxPage navigate={navigate} />, world: "staff" };
    if (currentPath === "/audits") return { element: <SecurityAuditTrailLogsPage navigate={navigate} />, world: "staff" };
    if (currentPath === "/users") return { element: <UsersPermissionsMatrixPage navigate={navigate} />, world: "staff" };
    if (currentPath === "/settings") return { element: <ComplianceSettingsPage navigate={navigate} />, world: "staff" };
    if (currentPath === "/access-denied") return { element: <AccessDeniedPage navigate={navigate} />, world: "staff" };

    // Anything else → a public 404 (no login forced for a mistyped URL).
    if (isStaffSection(currentPath)) return { element: <NotFoundPage navigate={navigate} />, world: "staff" };
    return { element: <NotFoundPage navigate={navigate} />, world: "public" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, tenantId, standaloneReportTenant]);

  return (
    <>
      {world === "public" ? (
        <PublicLayout navigate={navigate} currentPath={currentPath}>
          {element}
        </PublicLayout>
      ) : (
        <StaffShell currentPath={currentPath} navigate={navigate}>
          {element}
        </StaffShell>
      )}

      {/* Global chrome available in every world. */}
      <ToastHost />
      {world === "public" && <CookieBanner navigate={navigate} />}
    </>
  );
}
