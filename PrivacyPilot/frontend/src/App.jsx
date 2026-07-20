import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { initSession, ssoLoopDetected, selectAuthStatus } from './store/slices/authSlice';
import { can } from './lib/permissions';
import { orgPath } from './lib/paths';

import AuthGate from './components/auth/AuthGate';
import SsoCallback from './components/auth/SsoCallback';
import DashboardPage from './pages/Dashboard/DashboardPage';
import RegisterPage from './pages/Ropa/RegisterPage';
import ActivityWizardPage from './pages/Ropa/ActivityWizardPage';
import ActivityDetailPage from './pages/Ropa/ActivityDetailPage';
import DpiaListPage from './pages/Dpia/DpiaListPage';
import DpiaDetailPage from './pages/Dpia/DpiaDetailPage';
import NoticesPage from './pages/Notices/NoticesPage';
import VendorsPage from './pages/Vendors/VendorsPage';
import TransfersPage from './pages/Transfers/TransfersPage';
import BreachesPage from './pages/Breaches/BreachesPage';
import BreachDetailPage from './pages/Breaches/BreachDetailPage';
import DsarPage from './pages/Dsar/DsarPage';
import DsarDetailPage from './pages/Dsar/DsarDetailPage';
import AuditTrailPage from './pages/Audit/AuditTrailPage';
import UsersPage from './pages/Admin/UsersPage';
import SettingsPage from './pages/Settings/SettingsPage';
import ProfilePage from './pages/Profile/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import LandingPage from './pages/Landing/LandingPage';

/**
 * Route-level RBAC guard. The same `can()` matrix is enforced again inside
 * the mock services, so bypassing this guard still cannot mutate anything.
 */
function RequireAction({ action, children }) {
  const user = useSelector((s) => s.auth.user);
  if (!user || !can(user, action)) return <Navigate to={orgPath(user?.tenantId, '/dashboard')} replace />;
  return children ?? <Outlet />;
}

/**
 * The explicit /login route and legacy/unknown URLs resolve here. Once signed in
 * we forward to the tenant dashboard; otherwise the gate shows the SSO screen.
 */
function RootRedirect() {
  const status = useSelector(selectAuthStatus);
  const tenantId = useSelector((s) => s.auth.user?.tenantId);
  if (status === 'authenticated' && tenantId) {
    return <Navigate to={orgPath(tenantId, '/dashboard')} replace />;
  }
  return <AuthGate />;
}

export default function App() {
  const dispatch = useDispatch();

  // Verify the RegulaOne SSO session once on mount (RegulaOne is the single source
  // of truth for who is signed in). AuthGate renders the right screen off the result.
  useEffect(() => {
    dispatch(initSession());
  }, [dispatch]);

  // http.js fires this window event when it detects an endless login redirect loop;
  // the slice then flips to the "explain the loop" screen instead of bouncing forever.
  useEffect(() => {
    const onLoop = () => dispatch(ssoLoopDetected());
    window.addEventListener('privacypilot:sso-loop', onLoop);
    return () => window.removeEventListener('privacypilot:sso-loop', onLoop);
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public product front door. It checks session state only to tailor CTAs. */}
        <Route path="/" element={<LandingPage />} />

        {/* Landing spot the central login returns to after a successful sign-in. */}
        <Route path="/auth/sso-callback" element={<SsoCallback />} />

        {/* All app pages live under /company/{tenantId}/… and run behind the SSO gate. */}
        <Route path="/company/:tenantId" element={<AuthGate />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          {/* Own profile — available to any signed-in user, no extra permission. */}
          <Route path="profile" element={<ProfilePage />} />

          <Route path="register" element={<RequireAction action="VIEW_REGISTER"><RegisterPage /></RequireAction>} />
          <Route path="register/new" element={<RequireAction action="CREATE_ACTIVITY"><ActivityWizardPage /></RequireAction>} />
          <Route path="register/:id" element={<RequireAction action="VIEW_REGISTER"><ActivityDetailPage /></RequireAction>} />
          <Route path="register/:id/edit" element={<RequireAction action="EDIT_ACTIVITY"><ActivityWizardPage /></RequireAction>} />

          <Route path="dpia" element={<RequireAction action="VIEW_REGISTER"><DpiaListPage /></RequireAction>} />
          <Route path="dpia/:id" element={<RequireAction action="VIEW_REGISTER"><DpiaDetailPage /></RequireAction>} />

          <Route path="notices" element={<RequireAction action="GENERATE_NOTICES"><NoticesPage /></RequireAction>} />
          <Route path="vendors" element={<RequireAction action="MANAGE_VENDORS"><VendorsPage /></RequireAction>} />
          <Route path="transfers" element={<RequireAction action="MANAGE_TRANSFERS"><TransfersPage /></RequireAction>} />

          <Route path="breaches" element={<RequireAction action="MANAGE_BREACHES"><BreachesPage /></RequireAction>} />
          <Route path="breaches/:id" element={<RequireAction action="MANAGE_BREACHES"><BreachDetailPage /></RequireAction>} />

          <Route path="dsar" element={<RequireAction action="MANAGE_DSAR"><DsarPage /></RequireAction>} />
          <Route path="dsar/:id" element={<RequireAction action="MANAGE_DSAR"><DsarDetailPage /></RequireAction>} />

          <Route path="audit-trail" element={<RequireAction action="VIEW_AUDIT_TRAIL"><AuditTrailPage /></RequireAction>} />
          <Route path="users" element={<RequireAction action="MANAGE_USERS"><UsersPage /></RequireAction>} />
          <Route path="settings" element={<RequireAction action="EDIT_SETTINGS"><SettingsPage /></RequireAction>} />

          {/* Unknown /company/{id}/… path — render NotFound inside the app shell. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Login and old flat URLs preserve the existing SSO-gate behaviour. */}
        <Route path="/login" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
