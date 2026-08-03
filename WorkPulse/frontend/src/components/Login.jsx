import { useEffect } from "react";
import { redirectToCentralLogin } from "../api/authApi";
import { useTranslation } from "../hooks/useTranslation";

/**
 * WorkPulse does NOT have its own login form.
 * Authentication is handled centrally by the RegulaOne app (localhost:3000),
 * exactly like SafeWork.
 *
 * This component is shown when no valid session is found. It immediately sends
 * the browser to the central RegulaOne login page with a ?redirect_uri that
 * points back to WorkPulse's SSO callback route.
 */
export default function Login() {
  const { t } = useTranslation();

  useEffect(() => {
    redirectToCentralLogin();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 mx-auto border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-medium">{t("login.redirecting")}</p>
        <p className="text-slate-600 text-xs">{t("login.returnNote")}</p>
      </div>
    </div>
  );
}
