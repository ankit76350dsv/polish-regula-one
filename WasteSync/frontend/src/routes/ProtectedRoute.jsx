import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../hooks/useTranslation";

// Guards pages that require a logged-in user. While we are still checking the
// cookie we show a spinner; if there is no session we send the user to /login.
export default function ProtectedRoute() {
  const { isAuthenticated, authChecking } = useAuth();
  const location = useLocation();

  // This "please wait" line is shown before any page loads, so it is translated
  // too — it would otherwise be the one bit of English a Polish user always sees.
  const { t } = useTranslation();

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-slate-600 text-sm">{t("auth.verifying")}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
