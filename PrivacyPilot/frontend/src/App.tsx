/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  INITIAL_ACTIVITIES,
  INITIAL_AUDITS,
  INITIAL_DOCUMENTS,
  INITIAL_USERS,
} from './mockData';
import { ProcessingActivity, AuditLog, DocumentItem, User, Role } from './types';

// Importing Custom Reusable Components
import { AppSidebar } from './components/AppSidebar';
import { AppNavbar } from './components/AppNavbar';
import { AppModal } from './components/AppModal';
import { AppButton } from './components/AppButton';

// Importing Tab Features Modules
import { LoginFeature } from './features/LoginFeature';
import { DashboardFeature } from './features/DashboardFeature';
import { ActivitiesFeature } from './features/ActivitiesFeature';
import { WizardFeature } from './features/WizardFeature';
import { DpiaFeature } from './features/DpiaFeature';
import { PrivacyPolicyFeature } from './features/PrivacyPolicyFeature';
import { DocumentsFeature } from './features/DocumentsFeature';
import { AuditsFeature } from './features/AuditsFeature';
import { UsersFeature } from './features/UsersFeature';
import { SettingsFeature } from './features/SettingsFeature';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('Compliance Officer');

  // Dynamic system entities synced with localstorage
  const [activities, setActivities] = useState<ProcessingActivity[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Navigation route states
  const [currentRoute, setCurrentRoute] = useState('/dashboard');

  // Themes
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Collapse states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Active editing activity inside GDPR Wizard
  const [editingActivity, setEditingActivity] = useState<ProcessingActivity | null>(null);

  // Company Switcher states
  const [activeCompanyName, setActiveCompanyName] = useState('Acme Corp Holding Inc');
  const [isCompanySelectorOpen, setIsCompanySelectorOpen] = useState(false);

  // Load and recover indices from localStorage
  useEffect(() => {
    const actData = localStorage.getItem('privacypilot_activities');
    const audData = localStorage.getItem('privacypilot_audits');
    const docData = localStorage.getItem('privacypilot_documents');
    const usrData = localStorage.getItem('privacypilot_users');
    const coNameData = localStorage.getItem('privacypilot_company_name');
    const sessionEmail = localStorage.getItem('privacypilot_session_email');
    const sessionRole = localStorage.getItem('privacypilot_session_role');

    if (actData) setActivities(JSON.parse(actData));
    else {
      setActivities(INITIAL_ACTIVITIES);
      localStorage.setItem('privacypilot_activities', JSON.stringify(INITIAL_ACTIVITIES));
    }

    if (audData) setAudits(JSON.parse(audData));
    else {
      setAudits(INITIAL_AUDITS);
      localStorage.setItem('privacypilot_audits', JSON.stringify(INITIAL_AUDITS));
    }

    if (docData) setDocuments(JSON.parse(docData));
    else {
      setDocuments(INITIAL_DOCUMENTS);
      localStorage.setItem('privacypilot_documents', JSON.stringify(INITIAL_DOCUMENTS));
    }

    if (usrData) setUsers(JSON.parse(usrData));
    else {
      setUsers(INITIAL_USERS);
      localStorage.setItem('privacypilot_users', JSON.stringify(INITIAL_USERS));
    }

    if (coNameData) setActiveCompanyName(coNameData);

    if (sessionEmail && sessionRole) {
      setUserEmail(sessionEmail);
      setUserRole(sessionRole);
      setIsAuthenticated(true);
    }
  }, []);

  // Update theme classes on body
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.backgroundColor = '#020617'; // Deep night blue Slate-950
    } else {
      root.classList.remove('dark');
      root.style.backgroundColor = '#f8fafc'; // Slate-50
    }
  }, [theme]);

  // Auth logins handler
  const handleLoginSuccess = (email: string, role: string) => {
    setUserEmail(email);
    setUserRole(role);
    setIsAuthenticated(true);
    localStorage.setItem('privacypilot_session_email', email);
    localStorage.setItem('privacypilot_session_role', role);

    // Register login action inside secure audits log
    const loginLog: AuditLog = {
      id: `AUD-${Math.floor(Math.random() * 9005) + 1000}`,
      user: email.split('@')[0],
      email: email,
      action: 'Authorized Console Login Access',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      oldValue: 'Client terminal unauthenticated',
      newValue: `Role session: ${role} initialized`,
      ipAddress: '194.55.121.32',
      severity: 'Info',
    };

    const updatedAudits = [loginLog, ...audits];
    setAudits(updatedAudits);
    localStorage.setItem('privacypilot_audits', JSON.stringify(updatedAudits));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserEmail('');
    localStorage.removeItem('privacypilot_session_email');
    localStorage.removeItem('privacypilot_session_role');

    // Register sign-out action
    const logoutLog: AuditLog = {
      id: `AUD-${Math.floor(Math.random() * 9005) + 1000}`,
      user: userEmail.split('@')[0] || 'System',
      email: userEmail || 'system-deauth',
      action: 'Graceful Console Sign Out',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      oldValue: 'Active workspace session',
      newValue: 'Unauthenticated session',
      ipAddress: '194.55.121.32',
      severity: 'Info',
    };

    const updatedAudits = [logoutLog, ...audits];
    setAudits(updatedAudits);
    localStorage.setItem('privacypilot_audits', JSON.stringify(updatedAudits));
  };

  // Activities Action logic mutators
  const handleAddNewActivity = (data: Partial<ProcessingActivity>) => {
    const isEditing = !!editingActivity;
    let updated: ProcessingActivity[];

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

    if (isEditing && editingActivity) {
      updated = activities.map((act) =>
        act.id === editingActivity.id
          ? {
              ...act,
              ...data,
              lastUpdated: timestamp,
            }
          : act
      );

      // Create update audit log
      const logItem: AuditLog = {
        id: `AUD-${Math.floor(Math.random() * 9005) + 1000}`,
        user: userEmail.split('@')[0] || 'Compliance Lead',
        email: userEmail,
        action: `Modified processing activity record [${editingActivity.id}]`,
        timestamp,
        oldValue: `Title: ${editingActivity.name}, Dept: ${editingActivity.department}`,
        newValue: `Title: ${data.name}, Dept: ${data.department}`,
        ipAddress: '194.55.121.32',
        severity: 'Warning',
      };

      const updatedAudits = [logItem, ...audits];
      setAudits(updatedAudits);
      localStorage.setItem('privacypilot_audits', JSON.stringify(updatedAudits));
    } else {
      const newId = `ACT-00${activities.length + 1}`;
      const freshRecord: ProcessingActivity = {
        id: newId,
        name: data.name || 'Undefined record',
        purpose: data.purpose || '',
        dataCategory: data.dataCategory || [],
        legalBasis: data.legalBasis || 'Consent (Art. 6(1)(a))',
        retentionPeriod: data.retentionPeriod || '3 Years',
        dpiaRequired: data.dpiaRequired || false,
        lastUpdated: timestamp,
        status: data.status || 'Active',
        dataSubjects: data.dataSubjects || [],
        processors: data.processors || ['Core localized Cloud (default)'],
        securityMeasures: data.securityMeasures || ['Secure isolated networks'],
        internationalTransfers: data.internationalTransfers || 'None',
        riskScore: data.riskScore || 'Low',
        department: data.department || 'Sales & Finance',
      };

      updated = [freshRecord, ...activities];

      // Add create audit
      const logItem: AuditLog = {
        id: `AUD-${Math.floor(Math.random() * 9005) + 1000}`,
        user: userEmail.split('@')[0] || 'Compliance Lead',
        email: userEmail,
        action: `Registered new processing activity [${newId}]`,
        timestamp,
        oldValue: 'Empty record baseline',
        newValue: `Published Title: ${data.name}`,
        ipAddress: '194.55.121.32',
        severity: 'Info',
      };

      const updatedAudits = [logItem, ...audits];
      setAudits(updatedAudits);
      localStorage.setItem('privacypilot_audits', JSON.stringify(updatedAudits));
    }

    setActivities(updated);
    localStorage.setItem('privacypilot_activities', JSON.stringify(updated));

    // Redirect to activities index list
    setEditingActivity(null);
    setCurrentRoute('/activities');
  };

  const handleDeleteActivity = (id: string) => {
    const target = activities.find((a) => a.id === id);
    const updated = activities.filter((act) => act.id !== id);
    setActivities(updated);
    localStorage.setItem('privacypilot_activities', JSON.stringify(updated));

    // Audit track discard
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const logItem: AuditLog = {
      id: `AUD-${Math.floor(Math.random() * 9005) + 1000}`,
      user: userEmail.split('@')[0] || 'Compliance Lead',
      email: userEmail,
      action: `Discarded processing record [${id}]`,
      timestamp,
      oldValue: `Record: ${target?.name || 'Unknown'}`,
      newValue: 'Purged from indexed listings',
      ipAddress: '194.55.121.32',
      severity: 'Critical',
    };

    const updatedAudits = [logItem, ...audits];
    setAudits(updatedAudits);
    localStorage.setItem('privacypilot_audits', JSON.stringify(updatedAudits));
  };

  const handleDeleteMultipleActivities = (ids: string[]) => {
    const updated = activities.filter((act) => !ids.includes(act.id));
    setActivities(updated);
    localStorage.setItem('privacypilot_activities', JSON.stringify(updated));

    // Audit logs for bulk deletion
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const logItem: AuditLog = {
      id: `AUD-${Math.floor(Math.random() * 9005) + 1000}`,
      user: userEmail.split('@')[0] || 'Compliance Lead',
      email: userEmail,
      action: `Executed Bulk discard of ${ids.length} records`,
      timestamp,
      oldValue: `Discard items list: ${ids.join(', ')}`,
      newValue: 'Purged from lists registry',
      ipAddress: '194.55.121.32',
      severity: 'Critical',
    };

    const updatedAudits = [logItem, ...audits];
    setAudits(updatedAudits);
    localStorage.setItem('privacypilot_audits', JSON.stringify(updatedAudits));
  };

  // Recalculating mock Indices
  const handleRecalculateIndices = () => {
    // Generate a quick recalculation activity log
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const logItem: AuditLog = {
      id: `AUD-${Math.floor(Math.random() * 9005) + 1000}`,
      user: 'System Cron Service',
      email: 'system@privacy-pilot.io',
      action: 'Initiated full database risk rescan',
      timestamp,
      oldValue: `Verified ${activities.length} activities`,
      newValue: `Recalculations completed successfully. Compliance index safe at 94%.`,
      ipAddress: '127.0.0.1',
      severity: 'Info',
    };

    const updatedAudits = [logItem, ...audits];
    setAudits(updatedAudits);
    localStorage.setItem('privacypilot_audits', JSON.stringify(updatedAudits));
    alert('✓ Recalculation Triggered: Database tables scanned. Security metrics synced.');
  };

  // Switching Workspace Companies
  const handleCompanyChange = (name: string) => {
    setActiveCompanyName(name);
    localStorage.setItem('privacypilot_company_name', name);
    setIsCompanySelectorOpen(false);

    // Audit track
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const logItem: AuditLog = {
      id: `AUD-${Math.floor(Math.random() * 9005) + 1000}`,
      user: userEmail.split('@')[0] || 'Compliance Lead',
      email: userEmail,
      action: 'Switched Active Compliance entities',
      timestamp,
      oldValue: `Organization unit: ${activeCompanyName}`,
      newValue: `Active organization unit changed: ${name}`,
      ipAddress: '194.55.121.32',
      severity: 'Info',
    };

    const updatedAudits = [logItem, ...audits];
    setAudits(updatedAudits);
    localStorage.setItem('privacypilot_audits', JSON.stringify(updatedAudits));
  };

  return (
    <div className={`min-h-screen font-sans ${theme === 'dark' ? 'text-slate-205 dark bg-slate-950' : 'text-slate-800 bg-slate-50'}`}>
      {/* AUTHENTICATION ROUTE GUARD */}
      {!isAuthenticated ? (
        <LoginFeature id="login-module-feature" onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="flex">
          {/* LEFT SIDEBAR PANEL */}
          <AppSidebar
            id="sidebar-navigation-panel"
            isCollapsed={isSidebarCollapsed}
            setIsCollapsed={setIsSidebarCollapsed}
            currentRoute={currentRoute}
            onNavigate={(route) => {
              // Custom reset of editing activity on navigating to create activity route
              if (route === '/activities?action=create') {
                setEditingActivity(null);
                setCurrentRoute('/activities/create');
              } else {
                setCurrentRoute(route);
              }
              setIsMobileMenuOpen(false);
            }}
            onLogout={handleLogout}
            activeCompanyName={activeCompanyName}
            onCompanySwitchClick={() => setIsCompanySelectorOpen(true)}
          />

          {/* MAIN CONTAINER LAYOUT */}
          <div className="flex-1 min-w-0 flex flex-col min-h-screen">
            {/* TOP ACTIONS NAVBAR */}
            <AppNavbar
              id="platform-navbar-header"
              currentRoute={currentRoute}
              onNavigate={(route) => {
                setCurrentRoute(route);
              }}
              userEmail={userEmail}
              userRole={userRole}
              onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              theme={theme}
              setTheme={setTheme}
            />

            {/* PAGE VIEWS SECTION ROUTER */}
            <main className="p-4 md:p-5 flex-1 max-w-7xl w-full mx-auto animate-fade-in">
              {/* Route: /dashboard */}
              {currentRoute === '/dashboard' && (
                <DashboardFeature
                  id="dashboard-analytics-feature"
                  activities={activities}
                  audits={audits}
                  onNavigate={(route) => {
                    if (route === '/activities?action=create') {
                      setEditingActivity(null);
                      setCurrentRoute('/activities/create');
                    } else {
                      setCurrentRoute(route);
                    }
                  }}
                  onRefreshData={handleRecalculateIndices}
                />
              )}

              {/* Route: /activities */}
              {currentRoute === '/activities' && (
                <ActivitiesFeature
                  id="activities-registries-feature"
                  activities={activities}
                  onAddActivityClick={() => {
                    setEditingActivity(null);
                    setCurrentRoute('/activities/create');
                  }}
                  onDeleteActivity={handleDeleteActivity}
                  onDeleteMultipleActivities={handleDeleteMultipleActivities}
                  onEditActivityClick={(activity) => {
                    setEditingActivity(activity);
                    setCurrentRoute('/activities/create');
                  }}
                />
              )}

              {/* Route: /activities/create or edit */}
              {currentRoute === '/activities/create' && (
                <WizardFeature
                  id="activities-create-edit-wizard"
                  editingActivity={editingActivity}
                  onCancel={() => {
                    setEditingActivity(null);
                    setCurrentRoute('/activities');
                  }}
                  onSubmit={handleAddNewActivity}
                />
              )}

              {/* Route: /dpia */}
              {currentRoute === '/dpia' && (
                <DpiaFeature id="dpia-highrisk-radar" activitiesCount={activities.length} />
              )}

              {/* Route: /privacy-policy */}
              {currentRoute === '/privacy-policy' && (
                <PrivacyPolicyFeature id="policies-dynamic-generator" activities={activities} />
              )}

              {/* Route: /documents */}
              {currentRoute === '/documents' && (
                <DocumentsFeature id="document-vault-locker" initialDocuments={documents} />
              )}

              {/* Route: /audits */}
              {currentRoute === '/audits' && (
                <AuditsFeature id="audits-trail-ledger" initialAudits={audits} />
              )}

              {/* Route: /users */}
              {currentRoute === '/users' && (
                <UsersFeature
                  id="users-authorization-matrix"
                  initialUsers={users}
                  onInviteUser={(newUser) => {
                    const nextUsr = [...users, newUser as User];
                    setUsers(nextUsr);
                    localStorage.setItem('privacypilot_users', JSON.stringify(nextUsr));
                  }}
                  onModifyUserRole={(id, updatedRole) => {
                    const nextUsr = users.map((u) => (u.id === id ? { ...u, role: updatedRole } : u));
                    setUsers(nextUsr);
                    localStorage.setItem('privacypilot_users', JSON.stringify(nextUsr));
                  }}
                />
              )}

              {/* Route: /settings */}
              {currentRoute === '/settings' && (
                <SettingsFeature
                  id="settings-configurations-feature"
                  activeCompanyName={activeCompanyName}
                  onUpdateCompanyName={(nextName) => {
                    handleCompanyChange(nextName);
                  }}
                />
              )}
            </main>
          </div>

          {/* Collapsible Mobile Drawer Navigation Overlay */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs md:hidden">
              <div className="w-64 max-w-xs bg-slate-900 h-full p-4 relative">
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
                {/* Brand inside drawer */}
                <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
                  <div className="h-7 w-7 bg-indigo-650 rounded-lg flex items-center justify-center text-white font-black text-xs">
                    P
                  </div>
                  <span className="text-xs font-extrabold text-white tracking-wide">
                    PrivacyPilot Mobile
                  </span>
                </div>

                <nav className="space-y-1">
                  {[
                    { name: 'Dashboard', route: '/dashboard' },
                    { name: 'Processing Activities', route: '/activities' },
                    { name: 'DPIA Detection', route: '/dpia' },
                    { name: 'Privacy Policy', route: '/privacy-policy' },
                    { name: 'Documents', route: '/documents' },
                    { name: 'Audit Logs', route: '/audits' },
                    { name: 'Users & Access', route: '/users' },
                    { name: 'Settings', route: '/settings' },
                  ].map((m) => (
                    <button
                      key={m.name}
                      onClick={() => {
                        setCurrentRoute(m.route);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center px-3.5 py-2.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer ${
                        currentRoute === m.route ? 'bg-slate-800 text-indigo-400 font-extrabold' : ''
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          )}

          {/* Company switcher modal */}
          <AppModal
            id="workspace-switcher-modal"
            isOpen={isCompanySelectorOpen}
            onClose={() => setIsCompanySelectorOpen(false)}
            title="Switch Active Compliance Workspace"
            maxWidth="sm"
          >
            <div className="space-y-3.5">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                Select Active Organization
              </span>

              {[
                { name: 'Acme Corp Holding Inc', desc: 'Central corporate directory containing e-commerce pipelines.' },
                { name: 'RegulaOne SuperApp Core', desc: 'SaaS framework orchestrating compliance layers.' },
                { name: 'Polish Tech ventures Sp. z o.o.', desc: 'Regional branch tracking hiring evaluations candidate CVs.' },
              ].map((co) => {
                const isSelected = activeCompanyName === co.name;
                return (
                  <div
                    key={co.name}
                    onClick={() => handleCompanyChange(co.name)}
                    className={`p-3 border rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-600/10 border-indigo-505 font-extrabold text-indigo-900 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-850 hover:bg-slate-50/50'
                    }`}
                  >
                    <h4 className="text-xs font-black">{co.name}</h4>
                    <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                      {co.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </AppModal>
        </div>
      )}
    </div>
  );
}
