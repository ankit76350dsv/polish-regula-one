import { useEffect }                                              from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore }                                           from './store/authStore';

// Auth pages
import LoginPage            from './pages/Auth/LoginPage';
import SignupPage           from './pages/Auth/SignupPage';
import ConfirmSignupPage    from './pages/Auth/ConfirmSignupPage';
import ResendCodePage       from './pages/Auth/ResendCodePage';
import RespondChallengePage from './pages/Auth/RespondChallengePage';
import ChangePasswordPage   from './pages/Auth/ChangePasswordPage';
import SSOCallbackPage      from './pages/Auth/SSOCallbackPage';
import LandingPage          from './pages/Landing/LandingPage';
import NotFoundPage         from './pages/NotFoundPage';

// Dashboard pages
import Overview    from './pages/Dashboard/Overview';
import ProfilePage from './pages/Dashboard/ProfilePage';

// Notifications
import NotificationCenter      from './pages/Notifications/NotificationCenter';
import NotificationPreferences from './pages/Notifications/NotificationPreferences';

// Admin pages
import TenantManagement from './pages/Admin/TenantManagement';
import TenantDetailPage from './pages/Admin/TenantDetailPage';
import TenantPackagePage from './pages/Admin/TenantPackagePage';
import UserManagement   from './pages/Admin/UserManagement';
import PackageTiers     from './pages/Admin/PackageTiers';
import AdminTeam        from './pages/Admin/AdminTeam';
import UserPermissionsPage from './pages/Admin/UserPermissionsPage';
import AdminPlan        from './pages/Admin/AdminPlan';

// Module pages
import KSeFFlow          from './pages/Modules/KSeFFlow';
import WorkPulse         from './pages/Modules/WorkPulse';
import ModulePlaceholder from './pages/Modules/ModulePlaceholder';

import DashboardLayout from './components/layout/DashboardLayout';

/** Returns the dashboard path for a user — used after login / challenge / already-authed. */
function dashboardPath(tenantId) {
  return `/company/${tenantId ?? 'platform'}/overview`;
}

/**
 * Handles the /login route for users who already have a valid session.
 * - No session  → show LoginPage normally.
 * - Session + redirect_uri in URL → forward to that URI (cross-app SSO).
 * - Session, no redirect_uri → go to company dashboard.
 * Must live inside <BrowserRouter> so useSearchParams() works.
 */
function LoginRoute() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();

  if (!user) return <LoginPage />;

  const redirectUri = searchParams.get('redirect_uri');
  if (redirectUri) {
    window.location.href = redirectUri;
    return null;
  }

  return <Navigate to={dashboardPath(user.tenantId)} replace />;
}

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
        {/* ── Default public entry route ── */}
        <Route path="/" element={<LandingPage user={user} />} />

        {/* ── Public auth routes ── */}
        <Route path="/login"          element={<LoginRoute />} />
        <Route path="/register"       element={!user ? <SignupPage />         : <Navigate to="/" />} />
        <Route path="/auth/signup"    element={!user ? <SignupPage />         : <Navigate to="/" />} />
        <Route path="/auth/confirm"   element={!user ? <ConfirmSignupPage />  : <Navigate to="/" />} />
        <Route path="/auth/resend"    element={!user ? <ResendCodePage />     : <Navigate to="/" />} />
        <Route path="/auth/challenge"    element={<RespondChallengePage />} />
        <Route path="/auth/sso-callback" element={<SSOCallbackPage />} />

        {/* ── Protected routes — RequireAuth redirects to /login?redirect_uri=<path> ── */}
        <Route element={<RequireAuth />}>
          <Route path="/company/:tenantId/overview"        element={<Overview />} />
          <Route path="/company/:tenantId/profile"         element={<ProfilePage />} />
          <Route path="/company/:tenantId/change-password" element={<ChangePasswordPage />} />

          {/* Notifications — available to every authenticated role */}
          <Route path="/company/:tenantId/notifications"             element={<NotificationCenter />} />
          <Route path="/company/:tenantId/notifications/preferences" element={<NotificationPreferences />} />

          {user?.role === 'ROLE_SUPER_ADMIN' && (
            <>
              <Route path="/company/:tenantId/tenants"       element={<TenantManagement />} />
              <Route path="/company/:tenantId/tenants/:id"   element={<TenantDetailPage />} />
              <Route path="/company/:tenantId/tenants/:id/package" element={<TenantPackagePage />} />
              <Route path="/company/:tenantId/users"         element={<UserManagement />} />
              <Route path="/company/:tenantId/users/:userId" element={<UserPermissionsPage />} />
              <Route path="/company/:tenantId/package-tiers" element={<PackageTiers />} />
            </>
          )}

          {user?.role === 'ROLE_ADMIN' && (
            <>
              <Route path="/company/:tenantId/team"          element={<AdminTeam />} />
              <Route path="/company/:tenantId/team/:userId"  element={<UserPermissionsPage />} />
              <Route path="/company/:tenantId/my-plan"       element={<AdminPlan />} />
            </>
          )}

          <Route path="/company/:tenantId/modules/ksef"          element={<KSeFFlow />} />
          <Route path="/company/:tenantId/modules/workpulse"     element={<WorkPulse />} />
          <Route path="/company/:tenantId/modules/safework"      element={<ModulePlaceholder />} />
          <Route path="/company/:tenantId/modules/safevoice"     element={<ModulePlaceholder />} />
          <Route path="/company/:tenantId/modules/wastesync"     element={<ModulePlaceholder />} />
          <Route path="/company/:tenantId/modules/privacypilot"  element={<ModulePlaceholder />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
