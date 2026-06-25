import { Lock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PAGE_ROLES_REQUIRED } from '../../constants/navigation';

import Dashboard from '../Dashboard';
import Profile from '../Profile';
import InvoiceForm from '../InvoiceForm';
import InvoiceList from '../InvoiceList';
import IntegrationCenter from '../IntegrationCenter';
import CertificateManager from '../CertificateManager';
import OfflineQueue from '../OfflineQueue';
import AuditCenter from '../AuditCenter';
import ReceivedInvoices from '../ReceivedInvoices';
import PermissionsManager from '../PermissionsManager';
import NotificationCenter from '../NotificationCenter';

// ── WorkspaceContent ──────────────────────────────────────────────────────────
// This is the "router" for the inside of the app: it looks at the current
// section (taken from the URL) and shows the matching feature screen. It also
// guards every screen with the same role rule the sidebar uses — if the user's
// role is not allowed here, it shows a clear 403 panel instead of the screen.
//
// All data and handlers come from Workspace (the parent) as props, so this file
// stays a pure "pick the right screen" switch with no state of its own.
export default function WorkspaceContent({
  section,
  pageKey,
  invoiceId,
  tenant,
  role,
  user,
  permissions,
  invoices,
  isLoadingInvoices,
  govStatus,
  onSetGovStatus,
  onAddInvoice,
  onAddNotification,
  onRefreshInvoices,
  onRefreshHub,
  onNavigate,
  onOpenInvoice,
}) {
  const { t } = useLanguage();

  // Find the invoice the URL points at (e.g. /invoices/<id>), if any.
  const currentInvoiceObj = invoiceId
    ? invoices.find(inv => inv.id === invoiceId) ?? null
    : null;

  // Role guard: if the current role may not open this page, show the 403 panel.
  if (!PAGE_ROLES_REQUIRED[pageKey]?.includes(role)) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto mt-12 text-center space-y-4 shadow-xs">
        <div className="mx-auto w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center">
          <Lock size={20} />
        </div>
        <div className="space-y-1 border-slate-100 border-b pb-4">
          <h3 className="text-base font-bold text-slate-800 font-sans tracking-tight">{t('header.restrictedTitle')}</h3>
          <p className="text-xs text-slate-500 leading-normal">
            {t('header.restrictedDesc', { role })} <strong>{tenant.name}</strong>
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-450 font-mono text-left leading-normal border border-slate-150">
          <p>Status Code: <strong className="text-red-600">403 Forbidden (JWT Signature Valid)</strong></p>
          <p>Required: [{PAGE_ROLES_REQUIRED[pageKey]?.join(', ')}]</p>
          <p>Identity: <span className="text-slate-600 break-all">{user?.email}</span></p>
        </div>
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
        >
          {t('header.restrictedReturn')}
        </button>
      </div>
    );
  }

  // Allowed — render the screen for the current section.
  return (
    <>
      {section === 'dashboard' && (
        <Dashboard
          tenant={tenant}
          role={role}
          permissions={permissions}
          onNavigate={onNavigate}
          onOpenInvoice={onOpenInvoice}
        />
      )}

      {section === 'create' && (
        <InvoiceForm
          tenant={tenant}
          role={role}
          permissions={permissions}
          onAddInvoice={onAddInvoice}
          onAddNotification={onAddNotification}
          onNavigate={onNavigate}
          govStatus={govStatus}
        />
      )}

      {section === 'invoices' && !invoiceId && (
        <InvoiceList
          tenant={tenant}
          role={role}
          permissions={permissions}
          invoices={invoices}
          onAddNotification={onAddNotification}
          onAddInvoice={onAddInvoice}
          onViewInvoiceDetail={(inv) => onOpenInvoice(inv.id)}
        />
      )}

      {section === 'invoices' && invoiceId && (
        isLoadingInvoices ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            {t('dashboard.loadingInvoice')}
          </div>
        ) : currentInvoiceObj ? (
          <InvoiceForm
            tenant={tenant}
            role={role}
            permissions={permissions}
            onAddInvoice={onAddInvoice}
            onAddNotification={onAddNotification}
            onNavigate={onNavigate}
            govStatus={govStatus}
            existingInvoice={currentInvoiceObj}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto mt-12 text-center space-y-4 shadow-xs">
            <p className="text-slate-500 text-sm">{t('dashboard.invoiceNotFound', { id: invoiceId })}</p>
            <button onClick={() => onNavigate('invoices')} className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-800 transition">
              {t('dashboard.backToRepo')}
            </button>
          </div>
        )
      )}

      {section === 'received' && (
        <ReceivedInvoices
          tenant={tenant}
          role={role}
          permissions={permissions}
          onAddNotification={onAddNotification}
        />
      )}

      {section === 'permissions' && (
        <PermissionsManager
          tenant={tenant}
          role={role}
          permissions={permissions}
          onAddNotification={onAddNotification}
        />
      )}

      {section === 'offline' && (
        <OfflineQueue
          tenant={tenant}
          role={role}
          permissions={permissions}
          invoices={invoices}
          isLoading={isLoadingInvoices}
          onRefreshInvoices={onRefreshInvoices}
          onAddNotification={onAddNotification}
        />
      )}

      {section === 'integration' && (
        <IntegrationCenter
          tenant={tenant}
          role={role}
          permissions={permissions}
          govStatus={govStatus}
          onSetGovStatus={onSetGovStatus}
          onAddNotification={onAddNotification}
        />
      )}

      {section === 'certificates' && (
        <CertificateManager
          tenant={tenant}
          role={role}
          permissions={permissions}
          onAddNotification={onAddNotification}
        />
      )}

      {section === 'audit' && (
        <AuditCenter
          tenant={tenant}
          role={role}
          onAddNotification={onAddNotification}
        />
      )}

      {section === 'notifications' && (
        <NotificationCenter onChanged={onRefreshHub} />
      )}

      {section === 'profile' && (
        <Profile />
      )}
    </>
  );
}
