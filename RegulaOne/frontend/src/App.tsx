// Firebase auth listener removed - using mock auth via authStore
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Pages
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import Overview from './pages/Dashboard/Overview';
import TenantManagement from './pages/Admin/TenantManagement';
import UserManagement from './pages/Admin/UserManagement';
import PackageTiers from './pages/Admin/PackageTiers';
import AdminTeam from './pages/Admin/AdminTeam';
import AdminPlan from './pages/Admin/AdminPlan';
import KSeFFlow from './pages/Modules/KSeFFlow';
import WorkPulse from './pages/Modules/WorkPulse';
import ModulePlaceholder from './pages/Modules/ModulePlaceholder';
import DashboardLayout from './components/layout/DashboardLayout';

export default function App() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-zinc-200" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/" />} />

        <Route element={user ? <DashboardLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Overview />} />

          {/* Super Admin only routes */}
          {user?.role === 'ROLE_SUPER_ADMIN' && (
            <>
              <Route path="/tenants" element={<TenantManagement />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/package-tiers" element={<PackageTiers />} />
            </>
          )}

          {/* Admin only routes */}
          {user?.role === 'ROLE_ADMIN' && (
            <>
              <Route path="/team" element={<AdminTeam />} />
              <Route path="/my-plan" element={<AdminPlan />} />
            </>
          )}

          {/* Compliance module routes */}
          <Route path="/modules/ksef" element={<KSeFFlow />} />
          <Route path="/modules/workpulse" element={<WorkPulse />} />
          <Route path="/modules/safework" element={<ModulePlaceholder />} />
          <Route path="/modules/safevoice" element={<ModulePlaceholder />} />
          <Route path="/modules/wastesync" element={<ModulePlaceholder />} />
          <Route path="/modules/privacypilot" element={<ModulePlaceholder />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
