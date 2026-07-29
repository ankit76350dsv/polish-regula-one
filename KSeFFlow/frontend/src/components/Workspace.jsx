import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  listInvoices,
  getHubNotifications,
  getHubUnreadCount,
  markAllHubNotificationsRead,
} from '../api/ksefApi';
import { clearSsoRedirectGuard } from '../lib/api';

import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import WorkspaceContent from './layout/WorkspaceContent';

// ── Workspace ─────────────────────────────────────────────────────────────────
// The authenticated shell of KSeFFlow. App.jsx only handles "are you allowed in"
// (login + module/package checks) and the URL; once the user is in, Workspace
// takes over and owns everything the app actually shows:
//   - the business data (invoices, notifications) loaded from the backend,
//   - the layout chrome (Sidebar + Header),
//   - and the current feature screen (WorkspaceContent).
//
// It only mounts when the user is authenticated and allowed (it is rendered
// inside <ProtectedRoute>), so its data effects can safely run on mount.
//
// Props (all come from App.jsx, derived from the verified session + the URL):
//   user, tenant, role  → the signed-in identity and active organisation.
//   urlTenantId         → tenant id taken from the URL (used by Super Admin views).
//   section, invoiceId, pageKey → which screen the URL is pointing at.
//   onNavigate          → go to a section within this tenant.
//   onOpenInvoice       → open a single invoice's detail screen.
//   onLogout            → sign out of the shared SSO session.
//   logAuditAction      → record a local audit entry (shared with App's logout).
export default function Workspace({
  user,
  tenant,
  role,
  urlTenantId,
  section,
  invoiceId,
  pageKey,
  onNavigate,
  onOpenInvoice,
  onLogout,
  logAuditAction,
}) {
  const location = useLocation();

  // ── Business data ───────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [govStatus, setGovStatus] = useState('Connected');

  // Transient, client-only signals raised by components via addNotification (form errors etc.).
  // Persistent notifications come from the centralized Hub (RegulaOne), scoped to this user.
  const [notifications, setNotifications] = useState([]);
  const [hubNotifications, setHubNotifications] = useState([]);
  const [hubUnread, setHubUnread] = useState(0);

  // ── Layout UI state ───────────────────────────────────────────────────────────
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // KSeF permission codes for the logged-in user — passed to screens so they can
  // gate buttons/actions to match the backend's per-endpoint permission checks.
  const userPermissions = user?.permissions ?? [];

  // When the URL changes, close the mobile drawer and the notifications dropdown.
  useEffect(() => {
    setIsMobileSidebarOpen(false);
    setShowNotifications(false);
  }, [location.pathname]);

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

  useEffect(() => { loadHub(); }, [loadHub]);

  // Loads the tenant's invoices from the real KSeFFlow backend. Exposed as a callback so the
  // Offline Queue can refresh the list after a real manual retry.
  const loadInvoices = useCallback(() => {
    const tenantId = urlTenantId ?? tenant.id;
    if (!tenantId) return;
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
  }, [urlTenantId, tenant.id]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // Raise a transient, client-only notification (e.g. a form error) into the bell.
  const addNotification = (title, message, type) => {
    const newNotif = {
      id: `notif-${Date.now()}`,
      tenantId: tenant.id,
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const addInvoice = (invoice, silentAuditAction) => {
    setInvoices(prev => [invoice, ...prev]);
    if (silentAuditAction) {
      logAuditAction(silentAuditAction, `Invoice ${invoice.invoiceNumber} processed for Buyer ${invoice.buyerNIP}. Pre-tax: ${invoice.totalNet}.`);
    }
  };

  // Marks one offline-queued invoice as sent (or records a failed attempt) after a retry.
  // Kept here next to the invoice state so any future Offline Queue wiring can reuse it.
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
  // Referenced to keep the helper available without an unused-variable warning.
  void processOfflineItem;

  // The bell shows Hub notifications (persistent, from the server) merged with transient
  // local signals, newest first. Local signals are tenant-filtered; Hub items are already
  // scoped to this user by the backend.
  const visibleNotifications = [
    ...hubNotifications,
    ...notifications.filter(n => n.tenantId === tenant.id),
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

  // Open / close the bell dropdown. Opening it marks everything as read.
  const toggleNotifications = () => {
    setShowNotifications(prev => {
      if (!prev) clearNotificationsUnread();
      return !prev;
    });
  };

  // Number of invoices stuck in the offline queue for this tenant (sidebar badge).
  const offlineCount = invoices.filter(
    i => i.tenantId === tenant.id && i.status === 'OFFLINE_MODE',
  ).length;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans antialiased md:flex">

      {/* Dimmed backdrop behind the mobile drawer */}
      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] transition-opacity md:hidden"
        />
      )}

      <Sidebar
        tenant={tenant}
        role={role}
        currentSection={section}
        offlineCount={offlineCount}
        hubUnread={hubUnread}
        collapsed={isSidebarCollapsed}
        mobileOpen={isMobileSidebarOpen}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onNavigate={onNavigate}
      />

      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <Header
          user={user}
          tenant={tenant}
          notifications={visibleNotifications}
          unreadCount={unreadCount}
          showNotifications={showNotifications}
          onToggleNotifications={toggleNotifications}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <WorkspaceContent
            section={section}
            pageKey={pageKey}
            invoiceId={invoiceId}
            tenant={tenant}
            role={role}
            user={user}
            permissions={userPermissions}
            invoices={invoices}
            isLoadingInvoices={isLoadingInvoices}
            govStatus={govStatus}
            onSetGovStatus={setGovStatus}
            onAddInvoice={addInvoice}
            onAddNotification={addNotification}
            onRefreshInvoices={loadInvoices}
            onRefreshHub={loadHub}
            onNavigate={onNavigate}
            onOpenInvoice={onOpenInvoice}
          />
        </main>
      </div>
    </div>
  );
}
