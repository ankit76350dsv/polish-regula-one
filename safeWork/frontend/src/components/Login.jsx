import { useEffect } from "react";
import { redirectToCentralLogin } from "../api/authApi";

/**
 * SafeWork does NOT have its own login form anymore.
 * Authentication is handled centrally by the RegulaOne app (localhost:3000),
 * exactly like KSeFFlow.
 *
 * This component is shown when the app finds no valid session. It immediately
 * sends the browser to the central RegulaOne login page with a ?redirect_uri
 * that points back to SafeWork's SSO callback route.
 *
 * After the user signs in there, RegulaOne sets the shared-domain HttpOnly
 * cookie (Domain=localhost in dev) and returns the browser to
 * /auth/sso-callback here, where SafeWork re-checks /api/auth/me and loads
 * the user.
 */
export default function Login() {
  useEffect(() => {
    redirectToCentralLogin();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 mx-auto border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-medium">
          Redirecting to RegulaOne login…
        </p>
        <p className="text-slate-600 text-xs">
          You will be returned to SafeWork automatically after signing in.
        </p>
      </div>
    </div>
  );
}
