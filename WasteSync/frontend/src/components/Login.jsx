import { useEffect } from "react";
import { redirectToCentralLogin } from "../api/authApi";

// WasteSync has no login form. When no valid session is found, this page
// immediately sends the browser to the central RegulaOne login page, with a
// redirect_uri back to our SSO callback. After signing in there, RegulaOne sets
// the shared cookie and returns the user to /auth/sso-callback.
export default function Login() {
  useEffect(() => {
    redirectToCentralLogin();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 mx-auto border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-medium">Redirecting to RegulaOne login…</p>
        <p className="text-slate-600 text-xs">
          You will be returned to WasteSync automatically after signing in.
        </p>
      </div>
    </div>
  );
}
