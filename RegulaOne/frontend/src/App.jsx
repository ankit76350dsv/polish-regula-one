import { useEffect }                                              from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation }    from 'react-router-dom';
import { useAuthStore }                                           from './store/authStore';

// Auth pages
import LoginPage            from './pages/Auth/LoginPage';
import SignupPage           from './pages/Auth/SignupPage';
import ConfirmSignupPage    from './pages/Auth/ConfirmSignupPage';
import ResendCodePage       from './pages/Auth/ResendCodePage';
import RespondChallengePage from './pages/Auth/RespondChallengePage';
import ChangePasswordPage   from './pages/Auth/ChangePasswordPage';
import SSOCallbackPage      from './pages/Auth/SSOCallbackPage';

// Dashboard pages
import Overview    from './pages/Dashboard/Overview';
import ProfilePage from './pages/Dashboard/ProfilePage';

// Admin pages
import TenantManagement from './pages/Admin/TenantManagement';
import TenantDetailPage from './pages/Admin/TenantDetailPage';
import UserManagement   from './pages/Admin/UserManagement';
import PackageTiers     from './pages/Admin/PackageTiers';
import AdminTeam        from './pages/Admin/AdminTeam';
import AdminPlan        from './pages/Admin/AdminPlan';

// Module pages
import KSeFFlow          from './pages/Modules/KSeFFlow';
import WorkPulse         from './pages/Modules/WorkPulse';
import ModulePlaceholder from './pages/Modules/ModulePlaceholder';

import DashboardLayout from './components/layout/DashboardLayout';

/**
 * Wraps all protected routes. When the user is not authenticated, redirects
 * to /login and preserves the current path as ?redirect_uri so after a
 * successful login the user lands exactly where they intended, not on /.
 * Must be defined inside <BrowserRouter> so useLocation() works.
 */
function RequireAuth() {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect_uri=${returnTo}`} replace />;
  }

  return <DashboardLayout />;
}

export default function App() {
  const { user, isLoading, initAuth } = useAuthStore();

  // On every mount: restore session from the idToken HTTP-only cookie.
  // If the cookie is absent or expired, getMe returns 401 → user stays null.
  useEffect(() => {
    initAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-200 border-t-red-600" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Restoring Session…
          </span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public auth routes ── */}
        <Route path="/login"          element={!user ? <LoginPage />         : <Navigate to="/" />} />
        <Route path="/register"       element={!user ? <SignupPage />         : <Navigate to="/" />} />
        <Route path="/auth/signup"    element={!user ? <SignupPage />         : <Navigate to="/" />} />
        <Route path="/auth/confirm"   element={!user ? <ConfirmSignupPage />  : <Navigate to="/" />} />
        <Route path="/auth/resend"    element={!user ? <ResendCodePage />     : <Navigate to="/" />} />
        <Route path="/auth/challenge"    element={<RespondChallengePage />} />
        <Route path="/auth/sso-callback" element={<SSOCallbackPage />} />

        {/* ── Protected routes — RequireAuth redirects to /login?redirect_uri=<path> ── */}
        <Route element={<RequireAuth />}>
          <Route path="/"               element={<Overview />} />
          <Route path="/profile"        element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {user?.role === 'ROLE_SUPER_ADMIN' && (
            <>
              <Route path="/tenants"        element={<TenantManagement />} />
              <Route path="/tenants/:id"    element={<TenantDetailPage />} />
              <Route path="/users"          element={<UserManagement />} />
              <Route path="/package-tiers"  element={<PackageTiers />} />
            </>
          )}

          {user?.role === 'ROLE_ADMIN' && (
            <>
              <Route path="/team"    element={<AdminTeam />} />
              <Route path="/my-plan" element={<AdminPlan />} />
            </>
          )}

          <Route path="/modules/ksef"          element={<KSeFFlow />} />
          <Route path="/modules/workpulse"     element={<WorkPulse />} />
          <Route path="/modules/safework"      element={<ModulePlaceholder />} />
          <Route path="/modules/safevoice"     element={<ModulePlaceholder />} />
          <Route path="/modules/wastesync"     element={<ModulePlaceholder />} />
          <Route path="/modules/privacypilot"  element={<ModulePlaceholder />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
