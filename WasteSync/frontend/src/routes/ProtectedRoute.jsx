import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Guards pages that require a logged-in user. While we are still checking the
// cookie we show a spinner; if there is no session we send the user to /login.
export default function ProtectedRoute() {
  const { isAuthenticated, authChecking } = useAuth();
  const location = useLocation();

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-slate-600 text-sm">Checking authentication...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
