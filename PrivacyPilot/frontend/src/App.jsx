import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { restoreSession } from './store/slices/authSlice';
import { can } from './lib/permissions';

import LoginPage from './pages/Auth/LoginPage';
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
import NotFoundPage from './pages/NotFoundPage';

import DashboardLayout from './components/layout/DashboardLayout';

/** Blocks unauthenticated access; sends the user to /login. */
function RequireAuth() {
  const { user, status } = useSelector((s) => s.auth);
  if (status === 'restoring') return null;
  if (!user) return <Navigate to="/login" replace />;
  return <DashboardLayout />;
}

/**
 * Route-level RBAC guard. The same `can()` matrix is enforced again inside
 * the mock services, so bypassing this guard still cannot mutate anything.
 */
function RequireAction({ action, children }) {
  const user = useSelector((s) => s.auth.user);
  if (!user || !can(user.role, action)) return <Navigate to="/dashboard" replace />;
  return children ?? <Outlet />;
}

export default function App() {
  const dispatch = useDispatch();
  const { user, status } = useSelector((s) => s.auth);

  // Restore the demo session (sessionStorage) once on mount.
  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  if (status === 'restoring') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/register" element={<RequireAction action="VIEW_REGISTER"><RegisterPage /></RequireAction>} />
          <Route path="/register/new" element={<RequireAction action="CREATE_ACTIVITY"><ActivityWizardPage /></RequireAction>} />
          <Route path="/register/:id" element={<RequireAction action="VIEW_REGISTER"><ActivityDetailPage /></RequireAction>} />
          <Route path="/register/:id/edit" element={<RequireAction action="EDIT_ACTIVITY"><ActivityWizardPage /></RequireAction>} />

          <Route path="/dpia" element={<RequireAction action="VIEW_REGISTER"><DpiaListPage /></RequireAction>} />
          <Route path="/dpia/:id" element={<RequireAction action="VIEW_REGISTER"><DpiaDetailPage /></RequireAction>} />

          <Route path="/notices" element={<RequireAction action="GENERATE_NOTICES"><NoticesPage /></RequireAction>} />
          <Route path="/vendors" element={<RequireAction action="MANAGE_VENDORS"><VendorsPage /></RequireAction>} />
          <Route path="/transfers" element={<RequireAction action="MANAGE_TRANSFERS"><TransfersPage /></RequireAction>} />

          <Route path="/breaches" element={<RequireAction action="MANAGE_BREACHES"><BreachesPage /></RequireAction>} />
          <Route path="/breaches/:id" element={<RequireAction action="MANAGE_BREACHES"><BreachDetailPage /></RequireAction>} />

          <Route path="/dsar" element={<RequireAction action="MANAGE_DSAR"><DsarPage /></RequireAction>} />
          <Route path="/dsar/:id" element={<RequireAction action="MANAGE_DSAR"><DsarDetailPage /></RequireAction>} />

          <Route path="/audit-trail" element={<RequireAction action="VIEW_AUDIT_TRAIL"><AuditTrailPage /></RequireAction>} />
          <Route path="/users" element={<RequireAction action="MANAGE_USERS"><UsersPage /></RequireAction>} />
          <Route path="/settings" element={<RequireAction action="EDIT_SETTINGS"><SettingsPage /></RequireAction>} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
