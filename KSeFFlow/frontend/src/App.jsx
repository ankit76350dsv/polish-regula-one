import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { INITIAL_AUDIT_LOGS } from './data/mockData';
import { getMyTenant } from './api/ksefApi';
import { SSO_CALLBACK_URL, tryRefreshSession } from './lib/api';
import { useLanguage } from './context/LanguageContext';
import { PAGE_ROLES_REQUIRED } from './constants/navigation';

import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './components/LandingPage';
import NotFoundPage from './components/NotFoundPage';
import Workspace from './components/Workspace';

// Host URLs resolved at runtime (localhost or LAN IP) — see lib/serviceHosts.js.
import { REGULA_ONE_API_URL as API_URL, CENTRAL_LOGIN } from './lib/serviceHosts';

// Map RegulaOne roles to KSeFFlow role names used by this app's RBAC
const mapRole = (r) => {
  if (r === 'ROLE_SUPER_ADMIN') return 'Super Admin';
  if (r === 'ROLE_ADMIN')       return 'Company Admin';
  return 'Accountant';  // ROLE_USER
};

// ── App ─────────────────────────────────────────────────────────────────────
// App is intentionally thin. It is responsible for ONLY two things:
//   1. Authentication — checking the shared-domain SSO session, refreshing it,
//      and handling logout (this is the logic that decides "can you be here?").
//   2. Routing — reading the URL, deciding which tenant/section it points at,
//      and rejecting unknown paths.
//
// Everything the user actually *sees and uses* once logged in lives in
// <Workspace>: the sidebar, the header, and every feature screen. App just
// wraps it in <ProtectedRoute> (which renders Login / the access modal when
// the user is not allowed in).
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useLanguage();
  const isLandingPath = location.pathname === '/';

  // ── Parse the URL ─────────────────────────────────────────────────────────
  // Routes look like: /company/<tenantId>/<section>/<optional invoiceId>
  const pathParts = location.pathname.split('/').filter(Boolean);
  const urlTenantId      = pathParts[1] ?? null;
  const currentSection   = pathParts[2] || 'dashboard';
  const currentInvoiceId = (pathParts[2] === 'invoices' && pathParts[3]) ? pathParts[3] : null;
  const pageKey = currentSection === 'invoices' && currentInvoiceId ? 'invoice-detail' : currentSection;

  // ── SSO Auth state ─────────────────────────────────────────────────────────
  // isAuthLoading: true while we check the shared-domain cookie from RegulaOne.
  // When false: either the user is authenticated (isAuthenticated=true) or the
  // Login component fires the redirect to localhost:3000/login.
  const [isAuthLoading,   setIsAuthLoading]   = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser,     setCurrentUser]     = useState(null);
  // Transient /me failure (network/timeout) → ProtectedRoute shows an error + Retry.
  // (A clean "not authenticated" is NOT an error — that goes through the Login redirect.)
  const [authError,       setAuthError]       = useState(null);
  // Bumping this re-runs the session check — used by the Retry button.
  const [sessionReloadKey, setSessionReloadKey] = useState(0);
  const [activeTenant,    setActiveTenant]    = useState({ id: '', name: 'My Organisation', nip: '', subscriptionPlan: 'Active' });
  const [activeRole,      setActiveRole]      = useState('Company Admin');
  // Local audit trail. Write-only here (kept for traceability); fed by logout and
  // by the Workspace's invoice actions through the shared logAuditAction below.
  const [, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);

  // ── SSO session init ────────────────────────────────────────────────────────
  // On every page load: ask the RegulaOne backend if the shared-domain
  // idToken cookie is valid. If yes — populate user/tenant state and
  // render the app. If no (401) — Login.jsx will redirect to the central
  // login page with ?redirect_uri pointing back to /auth/sso-callback here.
  useEffect(() => {
    // (Re)start the session check — also runs when the Retry button bumps sessionReloadKey.
    setIsAuthLoading(true);
    setAuthError(null);

    // Guard against a dead / slow / wrong-IP backend. If /api/auth/me does not answer within a
    // few seconds, we abort it and fall through to the Login redirect — otherwise the app would
    // sit on the "Verifying session…" spinner forever (which is exactly what happens when
    // VITE_API_URL points at an old/unreachable host, e.g. after the local IP changes).
    const authAbort = new AbortController();
    const authTimeout = setTimeout(() => authAbort.abort(), 8000);

    const fetchMe = () =>
      fetch(`${API_URL}/api/auth/me`, { credentials: 'include', signal: authAbort.signal });

    fetchMe()
      .then(async res => {
        // If the login token expired while the tab was open, /me comes back 401/403.
        // Try ONE silent refresh and re-check before falling back to the login redirect,
        // so a still-valid session is not bounced out to the login page and back.
        if ((res.status === 401 || res.status === 403) && await tryRefreshSession()) {
          return fetchMe();
        }
        return res;
      })
      .then(res => {
        if (!res.ok) throw new Error('not authenticated');
        return res.json();
      })
      .then(json => {
        // /api/auth/me returns AppResponse<UserResponse> — unwrap the envelope.
        // Raw fetch does not go through apiFetch, so we do it manually here.
        const user = json?.data ?? json;

        const mappedRole = mapRole(user.role);
        const tenantId   = user.tenantId ?? '';
        const isSuperAdmin = mappedRole === 'Super Admin';

        // Carry the KSeF permission codes (e.g. ["KSEF_AUDITOR"]) through from /me so the
        // UI can gate actions the same way the backend does. Defaults to an empty array.
        setCurrentUser({
          name: user.name,
          email: user.email,
          role: mappedRole,
          permissions: Array.isArray(user.permissions) ? user.permissions : [],
          tenantId,
          tenantName: user.tenantName ?? null,
          // Account + module + package fields drive the KSeFFlow access gate (see lib/access.js):
          enabled: user.enabled,
          moduleIds: Array.isArray(user.moduleIds) ? user.moduleIds : [],
          planExpired: Boolean(user.planExpired),
          planExpiresAt: user.planExpiresAt ?? null,
        });
        setActiveRole(mappedRole);
        setActiveTenant({
          id:               tenantId,
          name:             user.tenantName ?? 'My Organisation',
          nip:              '',
          subscriptionPlan: 'Active',
        });
        setIsAuthenticated(true);
        // NOTE: we deliberately do NOT clear the SSO redirect-loop guard here.
        // /api/auth/me (RegulaOne :8080) succeeds on EVERY turn of the reload loop, so
        // clearing the counter here would reset it every cycle and hide the loop forever.
        // The guard is cleared only once a real KSeFFlow data call succeeds — see
        // Workspace's loadInvoices() (that proves the :8081 cookie works too).

        // Enrich the tenant with full organisation details (name, NIP, plan).
        // The tenant id is derived server-side from the authenticated JWT —
        // we never send it. Skipped for users with no tenant (e.g. Super Admin).
        if (tenantId) {
          getMyTenant()
            .then(tenant => {
              setActiveTenant(prev => ({
                ...prev,
                name:             tenant.name   ?? prev.name,
                nip:              tenant.nip    ?? '',
                // Seller address is required by the FA(3) invoice DTO — carry the
                // full organisation address through so InvoiceForm can populate it.
                address:          tenant.address    ?? prev.address    ?? '',
                postalCode:       tenant.postalCode ?? prev.postalCode ?? '',
                city:             tenant.city       ?? prev.city       ?? '',
                subscriptionPlan: tenant.status ?? prev.subscriptionPlan,
              }));
            })
            .catch(() => { /* non-fatal — keep the values seeded from /me */ });
        } else if (isSuperAdmin && urlTenantId) {
          // For Super Admin, set the active tenant from the URL
          setActiveTenant(prev => ({
            ...prev,
            id: urlTenantId,
            name: 'Super Admin Mode',
          }));
        }

        // ── URL tenant-ID correction ──────────────────────────────────────────
        // Three cases:
        //   1. Landing on a login/callback path → go to dashboard
        //   2. URL has a stale / wrong tenant ID → rewrite the path in place
        //   3. URL already has the correct tenant ID → do nothing

        const isEntryPath =
          location.pathname === '/auth/sso-callback' ||
          location.pathname === '/login';

        if (isEntryPath) {
          const params = new URLSearchParams(location.search);
          const returnPath = params.get('returnPath');
          if (returnPath) {
            navigate(returnPath, { replace: true });
          } else {
            navigate(`/company/${tenantId}/dashboard`, { replace: true });
          }
        } else if (urlTenantId && urlTenantId !== tenantId && !isSuperAdmin) {
          // The URL was built for a different tenant (stale bookmark, previous session,
          // or the "default" fallback). Swap the segment without losing the page.
          const correctedPath = location.pathname.replace(
            `/company/${urlTenantId}/`,
            `/company/${tenantId}/`,
          );
          navigate(correctedPath, { replace: true });
        }
      })
      .catch((err) => {
        // Two cases:
        //   - "not authenticated" (no/invalid session) → Login.jsx handles the SSO redirect.
        //   - network/timeout/host-unreachable → show an error + Retry (don't bounce to login).
        setIsAuthenticated(false);
        const transient = err?.name === 'AbortError' || (err?.message && err.message !== 'not authenticated');
        if (transient) {
          setAuthError(
            language === 'pl'
              ? 'Nie można połączyć się z serwerem. Sprawdź połączenie i spróbuj ponownie.'
              : 'Could not reach the server. Check your connection and try again.',
          );
        }
      })
      .finally(() => {
        clearTimeout(authTimeout);
        setIsAuthLoading(false);
      });
    // Re-runs on mount and whenever Retry bumps sessionReloadKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReloadKey]);

  // ── Proactive SSO session refresh ───────────────────────────────────────────
  // Cognito idToken and accessToken expire after 1 hour. Set a timer to silently
  // refresh them every 55 minutes, so active users never hit a 401 response.
  useEffect(() => {
    if (!isAuthenticated) return;

    const COGNITO_TOKEN_TTL_MS  = 60 * 60 * 1000; // 1 hour
    const REFRESH_BEFORE_EXPIRY = 5  * 60 * 1000; // 5 min
    const REFRESH_INTERVAL_MS   = COGNITO_TOKEN_TTL_MS - REFRESH_BEFORE_EXPIRY; // 55 min

    const refreshTimer = setInterval(async () => {
      console.log('[App] Proactively refreshing SSO session...');
      const success = await tryRefreshSession();
      if (!success) {
        console.warn('[App] Proactive session refresh failed.');
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(refreshTimer);
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && activeTenant.id && location.pathname === '/login') {
      navigate(`/company/${activeTenant.id}/dashboard`, { replace: true });
    }
  }, [isAuthenticated, location.pathname, activeTenant.id]);

  // ── SSO loop detector ───────────────────────────────────────────────────────
  // lib/api.js fires "ksef:sso-loop" when a 401 keeps redirecting us in circles
  // (e.g. the :8080 auth check passes but the :8081 cookie is rejected). When that
  // happens we stop reloading and show the Login screen's loop explanation instead.
  const [ssoLoop, setSsoLoop] = useState(false);
  useEffect(() => {
    const onLoop = () => setSsoLoop(true);
    window.addEventListener('ksef:sso-loop', onLoop);
    return () => window.removeEventListener('ksef:sso-loop', onLoop);
  }, []);

  // ── Navigation + audit helpers ────────────────────────────────────────────
  const navigateTo    = (section) => navigate(`/company/${activeTenant.id}/${section}`);
  const openInvoice   = (id)      => navigate(`/company/${activeTenant.id}/invoices/${id}`);

  // Record one local audit entry. Shared by logout (below) and by the Workspace's
  // invoice actions, so both write to the same trail.
  const logAuditAction = (action, detail, targetTenantId = activeTenant.id) => {
    const newLog = {
      id: `log-gen-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tenantId: targetTenantId,
      userId: activeRole === 'Super Admin' ? 'user-super-00' : 'user-02',
      userEmail: currentUser?.email || (activeRole === 'Super Admin' ? 'superadmin@regulaone.com' : 'admin@ksefflow.com'),
      userRole: activeRole,
      action,
      ipAddress: '194.29.130.' + Math.floor(Math.random() * 250 + 1),
      newValue: detail,
      complianceChecked: true,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handleLogout = () => {
    logAuditAction('USER_SESSION_TERMINATED', 'SSO session cleared. Shared-domain cookies invalidated.');
    // POST /api/sso/logout clears all auth cookies.
    // Response is AppResponse<{ logoutUrl }> — unwrap .data before reading logoutUrl.
    fetch(`${API_URL}/api/sso/logout`, { method: 'POST', credentials: 'include' })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((json) => {
        const data = json?.data ?? json;
        const logoutUrl = data?.logoutUrl ?? CENTRAL_LOGIN;
        window.location.href = `${logoutUrl}?redirect_uri=${encodeURIComponent(SSO_CALLBACK_URL)}`;
      })
      .catch(() => { window.location.href = CENTRAL_LOGIN; });
  };

  // ── Route validity ──────────────────────────────────────────────────────────
  // Decide whether the current URL is a path the app knows how to render.
  const isKnownRoute = (() => {
    if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/auth/sso-callback') {
      return true;
    }

    if (pathParts[0] !== 'company' || !pathParts[1]) {
      return false;
    }

    if (pathParts.length === 2) {
      return true;
    }

    if (pathParts[2] === 'invoices') {
      return pathParts.length === 3 || (pathParts.length === 4 && Boolean(pathParts[3]));
    }

    return pathParts.length === 3
      && pathParts[2] !== 'invoice-detail'
      && Object.prototype.hasOwnProperty.call(PAGE_ROLES_REQUIRED, pathParts[2]);
  })();

  // Show a spinner while the SSO cookie check is in flight
  if (isAuthLoading) {
    if (isLandingPath) {
      return <LandingPage isAuthLoading />;
    }

    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 mx-auto border-4 border-red-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">{t('header.verifying')}</p>
        </div>
      </div>
    );
  }

  if (!isKnownRoute) {
    return <NotFoundPage />;
  }

  if (isLandingPath) {
    return (
      <LandingPage
        isAuthenticated={isAuthenticated}
        tenantId={activeTenant.id || currentUser?.tenantId}
      />
    );
  }

  // Authentication, transient-error/retry, and the KSeFFlow module + package gates are all
  // handled by <ProtectedRoute>. Once it lets the user through, <Workspace> renders the
  // whole authenticated app (sidebar, header, and the current feature screen).
  return (
    <ProtectedRoute
      loading={isAuthLoading}
      error={authError}
      isAuthenticated={isAuthenticated && !ssoLoop}
      user={currentUser}
      onRetry={() => setSessionReloadKey((k) => k + 1)}
      onSignOut={handleLogout}
    >
      <Workspace
        user={currentUser}
        tenant={activeTenant}
        role={activeRole}
        urlTenantId={urlTenantId}
        section={currentSection}
        invoiceId={currentInvoiceId}
        pageKey={pageKey}
        onNavigate={navigateTo}
        onOpenInvoice={openInvoice}
        onLogout={handleLogout}
        logAuditAction={logAuditAction}
      />
    </ProtectedRoute>
  );
}
