import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  INITIAL_AUDIT_LOGS
} from './data/mockData';
import { listInvoices, getMyTenant, getHubNotifications, getHubUnreadCount, markAllHubNotificationsRead } from './api/ksefApi';
import { SSO_CALLBACK_URL, clearSsoRedirectGuard, tryRefreshSession } from './lib/api';
import { useLanguage } from './context/LanguageContext';

const API_URL       = import.meta.env.VITE_API_URL          ?? 'http://localhost:8080';
const CENTRAL_LOGIN = import.meta.env.VITE_CENTRAL_LOGIN_URL ?? 'http://localhost:3000/login';

// Map RegulaOne roles to KSeFFlow role names used by this app's RBAC
const mapRole = (r) => {
  if (r === 'ROLE_SUPER_ADMIN') return 'Super Admin';
  if (r === 'ROLE_ADMIN')       return 'Company Admin';
  return 'Accountant';  // ROLE_USER
};

import Dashboard from './components/Dashboard';
import InvoiceForm from './components/InvoiceForm';
import InvoiceList from './components/InvoiceList';
import IntegrationCenter from './components/IntegrationCenter';
import CertificateManager from './components/CertificateManager';
import OfflineQueue from './components/OfflineQueue';
import AuditCenter from './components/AuditCenter';
import ArchitectureDocs from './components/ArchitectureDocs';
import ReceivedInvoices from './components/ReceivedInvoices';
import PermissionsManager from './components/PermissionsManager';
import NotificationCenter from './components/NotificationCenter';
import Login from './components/Login';

import {
  Building2,
  UserSquare,
  FileEdit,
  FolderSearch,
  AlertTriangle,
  Cpu,
  ShieldCheck,
  BookOpen,
  FileClock,
  Bell,
  LogOut,
  LayoutDashboard,
  Lock,
  UserCheck,
  Inbox,
  KeyRound,
  Languages
} from 'lucide-react';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const urlTenantId   = pathParts[1] ?? null;
  const currentSection  = pathParts[2] || 'dashboard';
  const currentInvoiceId = (pathParts[2] === 'invoices' && pathParts[3]) ? pathParts[3] : null;
  const pageKey = currentSection === 'invoices' && currentInvoiceId ? 'invoice-detail' : currentSection;

  // ── SSO Auth state ─────────────────────────────────────────────────────────
  // isAuthLoading: true while we check the shared-domain cookie from RegulaOne.
  // When false: either the user is authenticated (isAuthenticated=true) or the
  // Login component fires the redirect to localhost:3000/login.
  const [isAuthLoading,   setIsAuthLoading]   = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser,     setCurrentUser]     = useState(null);
  const [activeTenant,    setActiveTenant]    = useState({ id: '', name: 'My Organisation', nip: '', subscriptionPlan: 'Active' });
  const [activeRole,      setActiveRole]      = useState('Company Admin');
  const [invoices, setInvoices] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  // Transient, client-only signals raised by components via addNotification (form errors etc.).
  // Starts empty — persistent notifications come from the Hub, not mock data.
  const [notifications, setNotifications] = useState([]);
  // Persistent notifications from the centralized Hub (RegulaOne), scoped to this user.
  const [hubNotifications, setHubNotifications] = useState([]);
  const [hubUnread, setHubUnread] = useState(0);
  const [govStatus, setGovStatus] = useState('Connected');
  const [showNotifications, setShowNotifications] = useState(false);

  const navigateTo = (page) => navigate(`/company/${activeTenant.id}/${page}`);

  // ── SSO session init ────────────────────────────────────────────────────────
  // On every page load: ask the RegulaOne backend if the shared-domain
  // idToken cookie is valid. If yes — populate user/tenant state and
  // render the app. If no (401) — Login.jsx will redirect to the central
  // login page with ?redirect_uri pointing back to /auth/sso-callback here.
  useEffect(() => {
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
        // The guard is cleared only once a real KSeFFlow data call succeeds — see the
        // listInvoices() effect below (that proves the :8081 cookie works too).

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
        //   1. Landing on a non-company path (sso-callback, /, /login) → go to dashboard
        //   2. URL has a stale / wrong tenant ID → rewrite the path in place
        //   3. URL already has the correct tenant ID → do nothing

        const isEntryPath =
          location.pathname === '/auth/sso-callback' ||
          location.pathname === '/'                  ||
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
      .catch(() => {
        // No valid session, or the request timed out / host was unreachable — Login.jsx
        // handles the SSO redirect. Either way we never stay stuck on the loading spinner.
        setIsAuthenticated(false);
      })
      .finally(() => {
        clearTimeout(authTimeout);
        setIsAuthLoading(false);
      });
  }, []);

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
    if (isAuthenticated && activeTenant.id && (location.pathname === '/' || location.pathname === '/login')) {
      navigate(`/company/${activeTenant.id}/dashboard`, { replace: true });
    }
  }, [isAuthenticated, location.pathname, activeTenant.id]);

  // ── Centralized notifications ───────────────────────────────────────────────
  // Pull the user's KSeFFlow notifications + unread count straight from the Hub (no mock data).
  // Exposed as a callback so the Notification Center can refresh the bell after acting on items.
  const loadHub = useCallback(() => {
    getHubNotifications({ size: 20 })
      .then(setHubNotifications)
      .catch(() => { /* non-fatal */ });
    getHubUnreadCount()
      .then(setHubUnread)
      .catch(() => { /* non-fatal */ });
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadHub();
  }, [isAuthenticated, loadHub]);

  useEffect(() => {
    const tenantId = urlTenantId ?? activeTenant.id;
    if (!isAuthenticated || !tenantId) return;
    setIsLoadingInvoices(true);
    listInvoices(tenantId)
      .then(fetched => {
        setInvoices(fetched);
        setIsLoadingInvoices(false);
        // A real KSeFFlow (:8081) call just succeeded — the session cookie works for
        // BOTH backends, so we are genuinely healthy. Reset the redirect-loop counter
        // so a real logout/expiry much later starts counting from zero again.
        clearSsoRedirectGuard();
      })
      .catch(() => { setIsLoadingInvoices(false); });
  }, [urlTenantId, isAuthenticated, activeTenant.id]);

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

  const currentInvoiceObj = currentInvoiceId
    ? invoices.find(inv => inv.id === currentInvoiceId) ?? null
    : null;

  // KSeF permission codes for the logged-in user — passed to components so they can
  // gate buttons/actions to match the backend's per-endpoint permission checks.
  const userPermissions = currentUser?.permissions ?? [];

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
      complianceChecked: true
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const addNotification = (title, message, type) => {
    const newNotif = {
      id: `notif-${Date.now()}`,
      tenantId: activeTenant.id,
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
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

  const addInvoice = (invoice, silentAuditAction) => {
    setInvoices(prev => [invoice, ...prev]);
    if (silentAuditAction) {
      logAuditAction(silentAuditAction, `Invoice ${invoice.invoiceNumber} processed for Buyer ${invoice.buyerNIP}. Pre-tax: ${invoice.totalNet}.`);
    }
  };


  const processOfflineItem = (invoiceId, success, newKsefId) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv;
      if (success) {
        logAuditAction('OFFLINE_QUEUE_FLUSHED', `Invoice ${inv.invoiceNumber} transmitted to KSeF.`);
        return { ...inv, status: 'SENT', ksefId: newKsefId, upoStatus: 'RECEIVED', upoTimestamp: new Date().toISOString(), submissionAttempts: inv.submissionAttempts + 1 };
      }
      return { ...inv, submissionAttempts: inv.submissionAttempts + 1, lastErrorMessage: 'HTTP 503 Service Unavailable - KSeF queue saturated.' };
    }));
  };

  // The bell shows Hub notifications (persistent, from the server) merged with transient
  // local signals, newest first. Local signals are tenant-filtered; Hub items are already
  // scoped to this user by the backend.
  const visibleNotifications = [
    ...hubNotifications,
    ...notifications.filter(n => n.tenantId === activeTenant.id),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Opening the bell marks everything read: the Hub server-side, plus local signals.
  const clearNotificationsUnread = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (hubUnread > 0) {
      markAllHubNotificationsRead().catch(() => { /* non-fatal */ });
      setHubNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setHubUnread(0);
    }
  };

  const unreadCount = hubUnread + notifications.filter(n => !n.read).length;

  const PAGE_ROLES_REQUIRED = {
    dashboard:       ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
    create:          ['Super Admin', 'Company Admin', 'Accountant'],
    invoices:        ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
    'invoice-detail':['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
    received:        ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
    permissions:     ['Super Admin', 'Company Admin'],
    offline:         ['Super Admin', 'Company Admin', 'Accountant'],
    integration:     ['Super Admin', 'Company Admin'],
    certificates:    ['Super Admin', 'Company Admin', 'Accountant'],
    audit:           ['Super Admin', 'Company Admin', 'Auditor'],
    notifications:   ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
    architecture:    ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor']
  };

  // Show a spinner while the SSO cookie check is in flight
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 mx-auto border-4 border-red-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">{t('header.verifying')}</p>
        </div>
      </div>
    );
  }

  // Not authenticated — Login.jsx redirects to central login with SSO redirect_uri.
  // ssoLoop covers the trickier case: /api/auth/me (:8080) passes so we LOOK logged in,
  // but a :8081 call keeps returning 401 and bouncing us through login. Rendering <Login />
  // here shows its loop explanation (the shared guard is already tripped) instead of
  // reloading the page over and over.
  if (!isAuthenticated || ssoLoop) {
    return <Login />;
  }

  const navItem = (section, label, Icon, extra) => {
    const isActive = currentSection === section || (section === 'invoices' && currentSection === 'invoices');
    const allowed  = PAGE_ROLES_REQUIRED[section]?.includes(activeRole);
    return (
      <button
        onClick={() => { navigateTo(section); setShowNotifications(false); }}
        className={`w-full text-left py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
          isActive ? 'bg-slate-100 text-slate-900 border-l-2 border-red-600 rounded-l-none' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        }`}
      >
        <span className="flex items-center gap-3">
          <Icon size={15} /> {label}
        </span>
        <span className="flex items-center gap-1.5">
          {!allowed && <Lock size={11} className="text-slate-400" />}
          {extra}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased">

      <header className="bg-white border-b border-slate-200 h-16 px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-red-700 text-white rounded-lg p-1.5 font-sans font-black flex items-center justify-center text-sm shadow-xs leading-none">
            R1
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-extrabold text-[15px] tracking-tight text-slate-800 uppercase">RegulaOne</span>
              <span className="text-[11px] bg-red-50 text-red-650 px-1.5 py-0.5 rounded font-mono font-bold leading-none">KSeFFlow</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Poland e-Invoicing Compliance SaaS Node</p>
          </div>
        </div>

        <div className="flex items-center gap-4">

          <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <Building2 size={13} className="text-slate-400" />
            <span className="text-slate-500 font-medium">{t('header.tenant')}:</span>
            <select
              value={activeTenant.id}
              disabled
              className="bg-transparent border-0 font-bold text-slate-700 focus:outline-none focus:ring-0 leading-tight pr-1 cursor-not-allowed opacity-80"
            >
              <option value={activeTenant.id}>{activeTenant.name || 'My Organisation'}</option>
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <UserSquare size={13} className="text-slate-400" />
            {activeRole !== 'Super Admin' && <Lock size={12} className="text-red-550 shrink-0" />}
            <span className="text-slate-500 font-medium">{t('header.sessionRole')}:</span>
            <select
              value={activeRole}
              disabled={activeRole !== 'Super Admin'}
              onChange={(e) => {
                const r = e.target.value;
                setActiveRole(r);
                logAuditAction('RBAC_ROLE_TRANSITION', `Role changed to: ${r}.`);
                addNotification('Role Adjusted', `Active permissions changed to: ${r}`, 'info');
              }}
              className={`bg-transparent border-0 font-bold text-red-650 focus:ring-0 focus:outline-none leading-tight pr-1 ${activeRole !== 'Super Admin' ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
            >
              <option value="Company Admin">{language === 'pl' ? 'Administrator firmy (Wszystkie uprawnienia)' : 'Company Admin (All permissions)'}</option>
              <option value="Accountant">{language === 'pl' ? 'Księgowy (Wystawianie faktur, certyfikaty)' : 'Accountant (Issue invoices, certs)'}</option>
              <option value="Finance User">{language === 'pl' ? 'Użytkownik finansowy (Wystawianie faktur, pliki)' : 'Finance User (Issue invoices, files)'}</option>
              <option value="Auditor">{language === 'pl' ? 'Audytor (Tylko podgląd zgodności)' : 'Auditor (View Only compliance)'}</option>
              <option value="Super Admin">{language === 'pl' ? 'Super Administrator (Uniwersalny Root)' : 'Super Admin (Universal Root)'}</option>
            </select>
          </div>

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'pl' : 'en')}
            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-slate-500 border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer font-bold text-xs shadow-xs"
            title={language === 'en' ? 'Przełącz na język polski' : 'Switch to English'}
          >
            <Languages size={14} className="text-slate-400" />
            <span className="text-[10px] text-slate-650 tracking-wide font-mono font-bold">{language.toUpperCase()}</span>
          </button>

          <div className="relative">
            <button
              onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) clearNotificationsUnread(); }}
              className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer"
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-[9px] font-bold text-white rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2.5 w-85 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4 space-y-3 font-sans text-xs">
                <div className="flex justify-between items-center border-b pb-2 border-slate-100">
                  <strong className="text-slate-800 font-bold text-xs uppercase tracking-wide">{t('header.signals')}</strong>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-700 text-[10px] cursor-pointer">{t('common.close')}</button>
                </div>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {visibleNotifications.map((notif) => (
                    <div key={notif.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-150 leading-relaxed">
                      <div className="flex justify-between font-semibold text-[11px]">
                        <span className={notif.type === 'error' ? 'text-red-650' : 'text-slate-705'}>{notif.title}</span>
                        <span className="text-[9px] text-slate-400">{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">{notif.message}</p>
                    </div>
                  ))}
                  {visibleNotifications.length === 0 && (
                    <p className="text-center text-slate-400 py-6">{t('header.clearSignals')}</p>
                  )}
                </div>
                <div className="border-t border-slate-100 pt-2">
                  <button
                    onClick={() => { setShowNotifications(false); navigateTo('notifications'); }}
                    className="w-full text-center text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    {language === 'pl' ? 'Zobacz wszystkie powiadomienia' : 'View all notifications'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {currentUser && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="hidden lg:block text-right">
                <p className="text-xs font-black text-slate-800 leading-tight flex items-center gap-1 justify-end">
                  <UserCheck size={12} className="text-emerald-600" />
                  {currentUser.name}
                </p>
                <span className="text-[10px] font-mono text-slate-400 leading-none block mt-0.5">{currentUser.email}</span>
              </div>
              <button
                onClick={handleLogout}
                title={t('header.signOut')}
                className="p-2 hover:bg-red-50 hover:text-red-700 text-slate-500 rounded-xl transition border border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">

        <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between shrink-0 font-sans">
          <div className="space-y-6">

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs md:block hidden shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{t('sidebar.tenantVault')}</span>
              <p className="font-semibold text-slate-700 truncate text-[11.5px] mt-1">{activeTenant.name}</p>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-100">
                <span>{t('sidebar.nip')}: <strong className="text-slate-600">{activeTenant.nip}</strong></span>
                <span className="text-emerald-600 font-bold">{activeTenant.subscriptionPlan}</span>
              </div>
            </div>

            <nav className="space-y-1">
              {navItem('dashboard', t('sidebar.dashboard'), LayoutDashboard)}
              {navItem('create', t('sidebar.createInvoice'), FileEdit)}
              {navItem('invoices', t('sidebar.repository'), FolderSearch)}
              {navItem('received', t('sidebar.receivedInvoices'), Inbox)}
              {navItem('permissions', t('sidebar.permissions'), KeyRound)}
              {navItem('offline', t('sidebar.offlineQueue'), AlertTriangle,
                invoices.filter(i => i.tenantId === activeTenant.id && i.status === 'OFFLINE_MODE').length > 0 ? (
                  <span className="bg-red-600 text-white font-bold font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                    {invoices.filter(i => i.tenantId === activeTenant.id && i.status === 'OFFLINE_MODE').length}
                  </span>
                ) : undefined
              )}
              {navItem('integration', t('sidebar.apiCenter'), Cpu)}
              {navItem('certificates', t('sidebar.certificates'), ShieldCheck)}
              {navItem('audit', t('sidebar.auditCenter'), BookOpen)}
              {navItem('notifications', language === 'pl' ? 'Powiadomienia' : 'Notifications', Bell,
                hubUnread > 0 ? (
                  <span className="bg-red-600 text-white font-bold font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                    {hubUnread}
                  </span>
                ) : undefined
              )}
              {navItem('architecture', t('sidebar.blueprints'), FileClock)}
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-100 hidden md:block text-[10.5px] text-slate-400 space-y-1">
            <p>{t('header.platformStatus')}: <strong>SECURE RODO_OK</strong></p>
            <p>{t('header.database')}: <strong>Postgres schemas</strong></p>
            <p className="truncate">{t('header.sla')}: <strong>Frankfurt AWS</strong></p>
          </div>
        </aside>

        <main className="flex-1 p-6 md:p-8 min-w-0 overflow-y-auto">

          {!PAGE_ROLES_REQUIRED[pageKey]?.includes(activeRole) ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto mt-12 text-center space-y-4 shadow-xs">
              <div className="mx-auto w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center">
                <Lock size={20} />
              </div>
              <div className="space-y-1 border-slate-100 border-b pb-4">
                <h3 className="text-base font-bold text-slate-800 font-sans tracking-tight">{t('header.restrictedTitle')}</h3>
                <p className="text-xs text-slate-500 leading-normal">
                  {t('header.restrictedDesc', { role: activeRole })} <strong>{activeTenant.name}</strong>
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-450 font-mono text-left leading-normal border border-slate-150">
                <p>Status Code: <strong className="text-red-600">403 Forbidden (JWT Signature Valid)</strong></p>
                <p>Required: [{PAGE_ROLES_REQUIRED[pageKey]?.join(', ')}]</p>
                <p>Identity: <span className="text-slate-600 break-all">{currentUser?.email}</span></p>
              </div>
              <button
                onClick={() => navigateTo('dashboard')}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                {t('header.restrictedReturn')}
              </button>
            </div>
          ) : (
            <>
              {currentSection === 'dashboard' && (
                <Dashboard
                  tenant={activeTenant}
                  invoices={invoices}
                  certificates={[]}
                  onNavigate={navigateTo}
                  govStatus={govStatus}
                  role={activeRole}
                />
              )}

              {currentSection === 'create' && (
                <InvoiceForm
                  tenant={activeTenant}
                  role={activeRole}
                  permissions={userPermissions}
                  onAddInvoice={addInvoice}
                  onAddNotification={addNotification}
                  onNavigate={navigateTo}
                  govStatus={govStatus}
                />
              )}

              {currentSection === 'invoices' && !currentInvoiceId && (
                <InvoiceList
                  tenant={activeTenant}
                  role={activeRole}
                  permissions={userPermissions}
                  invoices={invoices}
                  onAddNotification={addNotification}
                  onAddInvoice={addInvoice}
                  onViewInvoiceDetail={(inv) =>
                    navigate(`/company/${activeTenant.id}/invoices/${inv.id}`)
                  }
                />
              )}

              {currentSection === 'invoices' && currentInvoiceId && (
                isLoadingInvoices ? (
                  <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                    {t('dashboard.loadingInvoice')}
                  </div>
                ) : currentInvoiceObj ? (
                  <InvoiceForm
                    tenant={activeTenant}
                    role={activeRole}
                    permissions={userPermissions}
                    onAddInvoice={addInvoice}
                    onAddNotification={addNotification}
                    onNavigate={navigateTo}
                    govStatus={govStatus}
                    existingInvoice={currentInvoiceObj}
                  />
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto mt-12 text-center space-y-4 shadow-xs">
                    <p className="text-slate-500 text-sm">{t('dashboard.invoiceNotFound', { id: currentInvoiceId })}</p>
                    <button onClick={() => navigateTo('invoices')} className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-800 transition">
                      {t('dashboard.backToRepo')}
                    </button>
                  </div>
                )
              )}

              {currentSection === 'received' && (
                <ReceivedInvoices
                  tenant={activeTenant}
                  role={activeRole}
                  permissions={userPermissions}
                  onAddNotification={addNotification}
                />
              )}

              {currentSection === 'permissions' && (
                <PermissionsManager
                  tenant={activeTenant}
                  role={activeRole}
                  permissions={userPermissions}
                  onAddNotification={addNotification}
                />
              )}

              {currentSection === 'offline' && (
                <OfflineQueue
                  tenant={activeTenant}
                  role={activeRole}
                  invoices={invoices}
                  govStatus={govStatus}
                  onSetGovStatus={setGovStatus}
                  onProcessOfflineItem={processOfflineItem}
                  onAddNotification={addNotification}
                />
              )}

              {currentSection === 'integration' && (
                <IntegrationCenter
                  tenant={activeTenant}
                  role={activeRole}
                  permissions={userPermissions}
                  govStatus={govStatus}
                  onSetGovStatus={setGovStatus}
                  onAddNotification={addNotification}
                />
              )}

              {currentSection === 'certificates' && (
                <CertificateManager
                  tenant={activeTenant}
                  role={activeRole}
                  permissions={userPermissions}
                  onAddNotification={addNotification}
                />
              )}

              {currentSection === 'audit' && (
                <AuditCenter
                  tenant={activeTenant}
                  role={activeRole}
                  onAddNotification={addNotification}
                />
              )}

              {currentSection === 'notifications' && (
                <NotificationCenter onChanged={loadHub} />
              )}

              {currentSection === 'architecture' && (
                <ArchitectureDocs />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
