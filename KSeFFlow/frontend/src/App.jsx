import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  INITIAL_TENANTS,
  INITIAL_CERTIFICATES,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS
} from './data/mockData';
import { listInvoices } from './api/ksefApi';

import Dashboard from './components/Dashboard';
import InvoiceForm from './components/InvoiceForm';
import InvoiceList from './components/InvoiceList';
import IntegrationCenter from './components/IntegrationCenter';
import CertificateManager from './components/CertificateManager';
import OfflineQueue from './components/OfflineQueue';
import AuditCenter from './components/AuditCenter';
import ArchitectureDocs from './components/ArchitectureDocs';
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
  UserCheck
} from 'lucide-react';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const urlTenantId   = pathParts[1] ?? null;
  const currentSection  = pathParts[2] || 'dashboard';
  const currentInvoiceId = (pathParts[2] === 'invoices' && pathParts[3]) ? pathParts[3] : null;
  const pageKey = currentSection === 'invoices' && currentInvoiceId ? 'invoice-detail' : currentSection;

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('ksefflow_authenticated') === 'true'
  );
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ksefflow_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [sessionToken, setSessionToken] = useState(
    () => localStorage.getItem('ksefflow_jwt') || null
  );

  const [activeTenant, setActiveTenant] = useState(() => {
    const stored = localStorage.getItem('ksefflow_user');
    if (stored) {
      try {
        const usr = JSON.parse(stored);
        const found = INITIAL_TENANTS.find(t => t.id === usr.tenantId);
        if (found) return found;
      } catch { }
    }
    return INITIAL_TENANTS[0];
  });

  const [activeRole, setActiveRole] = useState(() => {
    const stored = localStorage.getItem('ksefflow_user');
    if (stored) {
      try {
        const usr = JSON.parse(stored);
        return usr.role;
      } catch { }
    }
    return 'Company Admin';
  });

  const [invoices, setInvoices] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [certificates, setCertificates] = useState(INITIAL_CERTIFICATES);
  const [, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [govStatus, setGovStatus] = useState('Connected');
  const [showNotifications, setShowNotifications] = useState(false);

  const navigateTo = (page) => navigate(`/company/${activeTenant.id}/${page}`);

  useEffect(() => {
    if (!urlTenantId) return;
    const found = INITIAL_TENANTS.find(t => t.id === urlTenantId);
    if (found && found.id !== activeTenant.id) setActiveTenant(found);
  }, [urlTenantId]);

  useEffect(() => {
    if (isAuthenticated && (location.pathname === '/' || location.pathname === '/login')) {
      navigate(`/company/${activeTenant.id}/dashboard`, { replace: true });
    }
  }, [isAuthenticated, location.pathname]);

  useEffect(() => {
    const tenantId = urlTenantId ?? activeTenant.id;
    if (!isAuthenticated || !tenantId) return;
    setIsLoadingInvoices(true);
    listInvoices(tenantId)
      .then(fetched => { setInvoices(fetched); setIsLoadingInvoices(false); })
      .catch(() => { setIsLoadingInvoices(false); });
  }, [urlTenantId, isAuthenticated]);

  const currentInvoiceObj = currentInvoiceId
    ? invoices.find(inv => inv.id === currentInvoiceId) ?? null
    : null;

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

  const handleLoginSuccess = (userSession) => {
    localStorage.setItem('ksefflow_authenticated', 'true');
    localStorage.setItem('ksefflow_user', JSON.stringify({
      email: userSession.email,
      name: userSession.name,
      role: userSession.role,
      tenantId: userSession.tenantId
    }));
    localStorage.setItem('ksefflow_jwt', userSession.token);

    setIsAuthenticated(true);
    setCurrentUser({ email: userSession.email, name: userSession.name, role: userSession.role, tenantId: userSession.tenantId });
    setSessionToken(userSession.token);
    setActiveRole(userSession.role);

    const matchedTenant = INITIAL_TENANTS.find(t => t.id === userSession.tenantId) || INITIAL_TENANTS[0];
    setActiveTenant(matchedTenant);

    let landingPage = 'dashboard';
    if (userSession.role === 'Accountant' || userSession.role === 'Finance User') landingPage = 'invoices';
    else if (userSession.role === 'Auditor') landingPage = 'audit';

    navigate(`/company/${userSession.tenantId}/${landingPage}`);

    const newLog = {
      id: `log-gen-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tenantId: userSession.tenantId,
      userId: 'user-id-dyn',
      userEmail: userSession.email,
      userRole: userSession.role,
      action: 'USER_JWT_AUTH_SUCCESS',
      ipAddress: '194.29.130.' + Math.floor(Math.random() * 250 + 1),
      newValue: `JWT Authentication Successful. Role: ${userSession.role}.`,
      complianceChecked: true
    };
    setAuditLogs(prev => [newLog, ...prev]);

    setNotifications(prev => [{
      id: `notif-${Date.now()}`,
      tenantId: userSession.tenantId,
      title: 'Decryption Key Seeded',
      message: `Welcome back, ${userSession.name}! Your workspace is unlocked.`,
      type: 'success',
      timestamp: new Date().toISOString(),
      read: false
    }, ...prev]);
  };

  const handleLogout = () => {
    logAuditAction('USER_SESSION_TERMINATED', 'JWT token destroyed. Workspace session reset successfully.');
    localStorage.removeItem('ksefflow_authenticated');
    localStorage.removeItem('ksefflow_user');
    localStorage.removeItem('ksefflow_jwt');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSessionToken(null);
    setActiveRole('Company Admin');
    setActiveTenant(INITIAL_TENANTS[0]);
    navigate('/login', { replace: true });
  };

  const addInvoice = (invoice, silentAuditAction) => {
    setInvoices(prev => [invoice, ...prev]);
    if (silentAuditAction) {
      logAuditAction(silentAuditAction, `Invoice ${invoice.invoiceNumber} processed for Buyer ${invoice.buyerNIP}. Pre-tax: ${invoice.totalNet}.`);
    }
  };

  const removeCertificate = (id) => {
    const cert = certificates.find(c => c.id === id);
    setCertificates(prev => prev.filter(c => c.id !== id));
    if (cert) logAuditAction('CERTIFICATE_REVOKED', `Certificate ${cert.fileName} stripped from digital directories.`);
  };

  const addCertificate = (cert) => {
    setCertificates(prev => [cert, ...prev]);
    logAuditAction('CERTIFICATE_ADDED', `Certificate ${cert.fileName} integrated into HSM vault.`);
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

  const clearNotificationsUnread = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const unreadCount = notifications.filter(n => !n.read).length;

  const PAGE_ROLES_REQUIRED = {
    dashboard:       ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
    create:          ['Super Admin', 'Company Admin', 'Accountant'],
    invoices:        ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
    'invoice-detail':['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
    offline:         ['Super Admin', 'Company Admin', 'Accountant'],
    integration:     ['Super Admin', 'Company Admin'],
    certificates:    ['Super Admin', 'Company Admin', 'Accountant'],
    audit:           ['Super Admin', 'Company Admin', 'Auditor'],
    architecture:    ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor']
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} tenants={INITIAL_TENANTS} />;
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
            <span className="text-slate-500">Corporate Tenant:</span>
            <select
              value={activeTenant.id}
              disabled={activeRole !== 'Super Admin'}
              onChange={(e) => {
                const found = INITIAL_TENANTS.find(t => t.id === e.target.value);
                if (found) {
                  setActiveTenant(found);
                  logAuditAction('SaaS_TENANT_SWITCHED', `Workspace transitioned to tenant: ${found.name}`);
                  addNotification('Tenant Changed', `Switched workspace to ${found.name}`, 'info');
                  navigate(`/company/${found.id}/dashboard`);
                }
              }}
              className={`bg-transparent border-0 font-bold text-slate-700 focus:outline-none focus:ring-0 leading-tight pr-1 ${activeRole !== 'Super Admin' ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
            >
              {INITIAL_TENANTS.map(tenant => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <UserSquare size={13} className="text-slate-400" />
            {activeRole !== 'Super Admin' && <Lock size={12} className="text-red-550 shrink-0" />}
            <span className="text-slate-500 font-medium">Session Role (RBAC):</span>
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
              <option value="Company Admin">Company Admin (All permissions)</option>
              <option value="Accountant">Accountant (Issue invoices, certs)</option>
              <option value="Finance User">Finance User (Issue invoices, files)</option>
              <option value="Auditor">Auditor (View Only compliance)</option>
              <option value="Super Admin">Super Admin (Universal Root)</option>
            </select>
          </div>

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
                  <strong className="text-slate-800 font-bold text-xs uppercase tracking-wide">Compliance Signals</strong>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-700 text-[10px] cursor-pointer">Close</button>
                </div>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {notifications.filter(n => n.tenantId === activeTenant.id).map((notif) => (
                    <div key={notif.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-150 leading-relaxed">
                      <div className="flex justify-between font-semibold text-[11px]">
                        <span className={notif.type === 'error' ? 'text-red-600' : 'text-slate-705'}>{notif.title}</span>
                        <span className="text-[9px] text-slate-400">{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">{notif.message}</p>
                    </div>
                  ))}
                  {notifications.filter(n => n.tenantId === activeTenant.id).length === 0 && (
                    <p className="text-center text-slate-400 py-6">All compliant channels clear.</p>
                  )}
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
                title="Secure Sign Out"
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
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Active Tenant Vault</span>
              <p className="font-semibold text-slate-700 truncate text-[11.5px] mt-1">{activeTenant.name}</p>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-100">
                <span>NIP: <strong className="text-slate-600">{activeTenant.nip}</strong></span>
                <span className="text-emerald-600 font-bold">{activeTenant.subscriptionPlan}</span>
              </div>
            </div>

            <nav className="space-y-1">
              {navItem('dashboard', 'Dashboard Summary', LayoutDashboard)}
              {navItem('create', 'Create FA(3) Invoice', FileEdit)}
              {navItem('invoices', 'Document Repository', FolderSearch)}
              {navItem('offline', 'Offline Queue & Retries', AlertTriangle,
                invoices.filter(i => i.tenantId === activeTenant.id && i.status === 'OFFLINE_MODE').length > 0 ? (
                  <span className="bg-red-600 text-white font-bold font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                    {invoices.filter(i => i.tenantId === activeTenant.id && i.status === 'OFFLINE_MODE').length}
                  </span>
                ) : undefined
              )}
              {navItem('integration', 'Government API Center', Cpu)}
              {navItem('certificates', 'HSM Certificates Key', ShieldCheck)}
              {navItem('audit', 'Compliance Audit Center', BookOpen)}
              {navItem('architecture', 'Developer Blueprints', FileClock)}
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-100 hidden md:block text-[10.5px] text-slate-400 space-y-1">
            <p>Platform status: <strong>SECURE RODO_OK</strong></p>
            <p>Database: <strong>Postgres schemas</strong></p>
            <p className="truncate">SLA Handshake: <strong>Frankfurt AWS</strong></p>
          </div>
        </aside>

        <main className="flex-1 p-6 md:p-8 min-w-0 overflow-y-auto">

          {!PAGE_ROLES_REQUIRED[pageKey]?.includes(activeRole) ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto mt-12 text-center space-y-4 shadow-xs">
              <div className="mx-auto w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center">
                <Lock size={20} />
              </div>
              <div className="space-y-1 border-slate-100 border-b pb-4">
                <h3 className="text-base font-bold text-slate-800 font-sans tracking-tight">RBAC Access Restricted</h3>
                <p className="text-xs text-slate-500 leading-normal">
                  Your active security clearance (<strong className="font-mono text-[11px] text-red-650 font-bold">{activeRole}</strong>) is insufficient for the <strong>{activeTenant.name}</strong> namespace.
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
                Return to Active Portal Directory
              </button>
            </div>
          ) : (
            <>
              {currentSection === 'dashboard' && (
                <Dashboard
                  tenant={activeTenant}
                  invoices={invoices}
                  certificates={certificates}
                  onNavigate={navigateTo}
                  govStatus={govStatus}
                  role={activeRole}
                />
              )}

              {currentSection === 'create' && (
                <InvoiceForm
                  tenant={activeTenant}
                  role={activeRole}
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
                  invoices={invoices}
                  onAddNotification={addNotification}
                  onViewInvoiceDetail={(inv) =>
                    navigate(`/company/${activeTenant.id}/invoices/${inv.id}`)
                  }
                />
              )}

              {currentSection === 'invoices' && currentInvoiceId && (
                isLoadingInvoices ? (
                  <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                    Loading invoice…
                  </div>
                ) : currentInvoiceObj ? (
                  <InvoiceForm
                    tenant={activeTenant}
                    role={activeRole}
                    onAddInvoice={addInvoice}
                    onAddNotification={addNotification}
                    onNavigate={navigateTo}
                    govStatus={govStatus}
                    existingInvoice={currentInvoiceObj}
                  />
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto mt-12 text-center space-y-4 shadow-xs">
                    <p className="text-slate-500 text-sm">Invoice <strong className="font-mono">{currentInvoiceId}</strong> not found.</p>
                    <button onClick={() => navigateTo('invoices')} className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-800 transition">
                      Back to Repository
                    </button>
                  </div>
                )
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
                  govStatus={govStatus}
                  onSetGovStatus={setGovStatus}
                  onAddNotification={addNotification}
                />
              )}

              {currentSection === 'certificates' && (
                <CertificateManager
                  tenant={activeTenant}
                  role={activeRole}
                  certificates={certificates}
                  onAddCertificate={addCertificate}
                  onRemoveCertificate={removeCertificate}
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
