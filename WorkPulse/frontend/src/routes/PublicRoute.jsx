import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOrgHome } from "../utils/paths";

// The opposite of ProtectedRoute: used for the /login page. If the user is already
// signed in, we send them to their own company's home page instead.
export default function PublicRoute() {
  const { isAuthenticated, authChecking } = useAuth();

  // Their home page: "/company/{tenantId}/home".
  const orgHome = useOrgHome();

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-slate-600 text-sm">Checking authentication...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    // Send them straight to their home page. "/" would also work (it forwards
    // there), but going direct saves a second redirect and an address-bar flicker.
    return <Navigate to={orgHome} replace />;
  }

  return <Outlet />;
}
