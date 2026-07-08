import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// SSO callback landing page.
//
// After the user signs in on the central RegulaOne page, the browser returns
// here. By now AuthProvider has run checkAuth() (which calls /api/auth/me using
// the shared cookie RegulaOne just set). Based on the result we either show a
// spinner, go to the dashboard, or bounce back to /login.
export default function SsoCallback() {
  const { authChecking, isAuthenticated } = useAuth();

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 mx-auto border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Verifying session…</p>
        </div>
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? "/" : "/login"} replace />;
}
