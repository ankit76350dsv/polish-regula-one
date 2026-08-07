import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import { useOrgHome } from "../utils/paths";

/**
 * SSO callback landing page (same idea as KSeFFlow).
 *
 * After the user signs in on the central RegulaOne login page, the browser is
 * sent back here (/auth/sso-callback). By the time this renders, AuthProvider
 * has already run checkAuth() on app load, which calls /api/auth/me using the
 * shared cookie that RegulaOne just set.
 *
 * Based on that check we either:
 *   - still waiting  → show a spinner
 *   - logged in      → go to the SafeWork home page
 *   - not logged in  → bounce back to the login redirect (e.g. cookie failed)
 */
export default function SsoCallback() {
  const { authChecking, isAuthenticated } = useAuth();
  const { t } = useTranslation();

  // The home page for the user who just signed in: "/company/{tenantId}/home".
  // The tenant id arrives in the /api/auth/me answer we have just received.
  const orgHome = useOrgHome();

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 mx-auto border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">{t("login.verifying")}</p>
        </div>
      </div>
    );
  }

  // Logged in → their company home page, so the first address they see already
  // carries the company id. If the tenant is somehow missing, useOrgHome() gives us
  // "/" and the guards decide what to show, instead of a broken URL.
  // Not logged in → /login, which redirects to central login.
  return <Navigate to={isAuthenticated ? orgHome : "/login"} replace />;
}
