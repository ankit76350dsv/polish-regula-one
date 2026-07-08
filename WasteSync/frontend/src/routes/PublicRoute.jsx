import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// The opposite of ProtectedRoute: used for the /login page. If the user is
// already signed in, we send them to the dashboard instead.
export default function PublicRoute() {
  const { isAuthenticated, authChecking } = useAuth();

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-slate-600 text-sm">Checking authentication...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
