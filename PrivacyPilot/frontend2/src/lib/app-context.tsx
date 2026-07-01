/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Tenant, User, Activity, DPIA, Risk, Vendor, Transfer, Incident, DSARRequest, Audit, Task, Notification, SupportTicket, UserRole } from '../types';
import { getInitialData, persistAppState } from './mock-api';

interface AppContextType {
  tenants: Tenant[];
  users: User[];
  activities: Activity[];
  dpias: DPIA[];
  risks: Risk[];
  vendors: Vendor[];
  transfers: Transfer[];
  incidents: Incident[];
  requests: DSARRequest[];
  audits: Audit[];
  tasks: Task[];
  notifications: Notification[];
  tickets: SupportTicket[];
  platformLogs: any[];
  
  selectedTenantId: string;
  activeRole: UserRole;
  currentLanguage: 'en' | 'pl';
  
  // Navigation & UI helper
  currentHash: string;
  navigateTo: (hash: string) => void;
  showCommandPalette: boolean;
  setShowCommandPalette: (show: boolean) => void;
  showNotificationDrawer: boolean;
  setShowNotificationDrawer: (show: boolean) => void;
  
  // State operations
  switchTenant: (id: string) => void;
  switchRole: (role: UserRole) => void;
  switchLanguage: (lang: 'en' | 'pl') => void;
  
  addActivity: (activity: Omit<Activity, 'id' | 'completenessScore' | 'lastModifiedBy' | 'lastModifiedAt'>) => string;
  updateActivity: (activity: Activity) => void;
  deleteActivity: (id: string) => void;
  
  addDpia: (dpia: DPIA) => void;
  updateDpia: (dpia: DPIA) => void;
  
  addIncident: (incident: Omit<Incident, 'id' | 'timerDeadline' | 'status' | 'timeline'>) => string;
  updateIncident: (incident: Incident) => void;
  
  addDsarRequest: (request: Omit<DSARRequest, 'id' | 'status' | 'verificationChecked' | 'collectionTasks' | 'responseText' | 'submittedDate'>) => string;
  updateDsarRequest: (request: DSARRequest) => void;
  
  addVendor: (vendor: Omit<Vendor, 'id' | 'questionnaireCompleted'>) => string;
  updateVendor: (vendor: Vendor) => void;
  
  addAudit: (audit: Omit<Audit, 'id' | 'status' | 'findings' | 'evidenceCount'>) => string;
  updateAudit: (audit: Audit) => void;

  addTask: (task: Omit<Task, 'id'>) => string;
  toggleTaskStatus: (id: string) => void;
  
  addNotification: (title: string, message: string, type: 'info' | 'warning' | 'alert' | 'success') => void;
  markNotificationsAsRead: () => void;
  
  addPlatformLog: (actor: string, action: string, target: string) => void;
  addSupportTicket: (ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>) => void;

  // Visual feedback helper
  toasts: { id: string; message: string; type: 'success' | 'info' | 'error' | 'warning' }[];
  showToast: (message: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = getInitialData();

  // Primary entities
  const [tenants, setTenants] = useState<Tenant[]>(initial.tenants);
  const [users, setUsers] = useState<User[]>(initial.users);
  const [activities, setActivities] = useState<Activity[]>(initial.activities);
  const [dpias, setDpias] = useState<DPIA[]>(initial.dpias);
  const [risks, setRisks] = useState<Risk[]>(initial.risks);
  const [vendors, setVendors] = useState<Vendor[]>(initial.vendors);
  const [transfers, setTransfers] = useState<Transfer[]>(initial.transfers);
  const [incidents, setIncidents] = useState<Incident[]>(initial.incidents);
  const [requests, setRequests] = useState<DSARRequest[]>(initial.requests);
  const [audits, setAudits] = useState<Audit[]>(initial.audits);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [notifications, setNotifications] = useState<Notification[]>(initial.notifications);
  const [tickets, setTickets] = useState<SupportTicket[]>(initial.tickets);
  const [platformLogs, setPlatformLogs] = useState<any[]>(initial.platformLogs);

  // Shell Preferences
  const [selectedTenantId, setSelectedTenantId] = useState<string>(initial.selectedTenantId);
  const [activeRole, setActiveRole] = useState<UserRole>(initial.activeRole as UserRole);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'pl'>(initial.currentLanguage);

  // Route & UI State
  const [currentHash, setCurrentHash] = useState<string>(window.location.hash || '#/login');
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState<boolean>(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'error' | 'warning' }[]>([]);

  // Listen to hash routes
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#/login');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (hash: string) => {
    window.location.hash = hash;
    setCurrentHash(hash);
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Persist edits back to storage on major shifts
  useEffect(() => {
    persistAppState({
      tenants,
      users,
      activities,
      dpias,
      risks,
      vendors,
      transfers,
      incidents,
      requests,
      audits,
      tasks,
      notifications,
      tickets,
      platformLogs,
      selectedTenantId,
      activeRole: activeRole as any,
      currentLanguage
    });
  }, [
    tenants,
    users,
    activities,
    dpias,
    risks,
    vendors,
    transfers,
    incidents,
    requests,
    audits,
    tasks,
    notifications,
    tickets,
    platformLogs,
    selectedTenantId,
    activeRole,
    currentLanguage
  ]);

  const switchTenant = (id: string) => {
    setSelectedTenantId(id);
    const tenant = tenants.find((t) => t.id === id);
    if (tenant) {
      setCurrentLanguage(tenant.language);
      showToast(currentLanguage === 'pl' ? `Przełączono podmiot na: ${tenant.name}` : `Switched organization to: ${tenant.name}`, 'info');
    }
  };

  const switchRole = (role: UserRole) => {
    setActiveRole(role);
    showToast(currentLanguage === 'pl' ? `Zmieniono rolę roboczą na: ${role}` : `Simulated workspace role updated to: ${role}`, 'info');
  };

  const switchLanguage = (lang: 'en' | 'pl') => {
    setCurrentLanguage(lang);
    showToast(lang === 'pl' ? 'Zmieniono język interfejsu na Polski' : 'Language preference updated to English', 'success');
  };

  // CRUD Operations
  const addActivity = (act: Omit<Activity, 'id' | 'completenessScore' | 'lastModifiedBy' | 'lastModifiedAt'>) => {
    const newId = `act-${activities.length + 1}`;
    // Score compilation completeness
    let filledFields = 0;
    const fieldsToTrack = [act.name, act.department, act.purpose, act.systemUsed, act.lawfulBasis, act.retentionPeriod];
    fieldsToTrack.forEach(f => { if (f && f.trim() !== '') filledFields++; });
    const completenessScore = Math.round((filledFields / fieldsToTrack.length) * 100);

    const newActivity: Activity = {
      ...act,
      id: newId,
      completenessScore,
      lastModifiedBy: users.find(u => u.role === activeRole)?.name || 'Tomasz Wiśniewski',
      lastModifiedAt: new Date().toISOString()
    };

    setActivities((prev) => [newActivity, ...prev]);
    addPlatformLog(newActivity.lastModifiedBy, `Created processing activity: ${act.name}`, 'ROPA');
    addNotification('New Activity Recorded', `${newActivity.lastModifiedBy} submitted a new activity: ${act.name}`, 'success');
    
    // Automatically evaluate DPIA requirement
    if (act.dpiaRequired === 'required') {
      const newDpiaId = `dpia-${dpias.length + 1}`;
      const newDpia: DPIA = {
        id: newDpiaId,
        activityId: newId,
        activityName: act.name,
        status: 'draft',
        riskScore: 10,
        criteriaMatched: [],
        thresholdScore: 0,
        processingDescription: act.description,
        necessityDetails: 'Required assessment based on high-risk threshold indicators.',
        risksIdentified: [],
        safeguards: act.securityMeasures,
        residualRisk: 'medium',
        dpoAdvice: 'Awaiting formal risk analysis and DPO submission files.',
        approvals: [
          { role: 'DPO', approver: 'Janusz Nowak (IOD)', status: 'pending' },
          { role: 'Tenant Admin', approver: 'Tomasz Wiśniewski', status: 'pending' }
        ],
        timeline: [{ id: Math.random().toString(), actor: newActivity.lastModifiedBy, action: 'Initiated threshold screening', date: new Date().toISOString().split('T')[0] }]
      };
      setDpias(prev => [newDpia, ...prev]);
    }

    showToast(currentLanguage === 'pl' ? `Pomyślnie dodano czynność: ${act.name}` : `Activity recorded successfully: ${act.name}`, 'success');
    return newId;
  };

  const updateActivity = (updatedAct: Activity) => {
    // Recalculate completeness
    let filledFields = 0;
    const fieldsToTrack = [updatedAct.name, updatedAct.department, updatedAct.purpose, updatedAct.systemUsed, updatedAct.lawfulBasis, updatedAct.retentionPeriod];
    fieldsToTrack.forEach(f => { if (f && f.trim() !== '') filledFields++; });
    updatedAct.completenessScore = Math.round((filledFields / fieldsToTrack.length) * 100);
    updatedAct.lastModifiedBy = users.find(u => u.role === activeRole)?.name || 'Tomasz Wiśniewski';
    updatedAct.lastModifiedAt = new Date().toISOString();

    setActivities((prev) => prev.map((a) => (a.id === updatedAct.id ? updatedAct : a)));
    addPlatformLog(updatedAct.lastModifiedBy, `Updated processing activity: ${updatedAct.name}`, 'ROPA');
    showToast(currentLanguage === 'pl' ? `Zaktualizowano czynność: ${updatedAct.name}` : `Activity updated successfully: ${updatedAct.name}`, 'success');
  };

  const deleteActivity = (id: string) => {
    const act = activities.find((a) => a.id === id);
    if (!act) return;
    setActivities((prev) => prev.filter((a) => a.id !== id));
    addPlatformLog(users.find(u => u.role === activeRole)?.name || 'Admin', `Deleted activity: ${act.name}`, 'ROPA');
    showToast(currentLanguage === 'pl' ? `Usunięto czynność: ${act.name}` : `Deleted activity: ${act.name}`, 'warning');
  };

  const addDpia = (dpia: DPIA) => {
    setDpias((prev) => [dpia, ...prev]);
    showToast(`DPIA assessment created for ${dpia.activityName}`, 'success');
  };

  const updateDpia = (updatedDpia: DPIA) => {
    setDpias((prev) => prev.map((d) => (d.id === updatedDpia.id ? updatedDpia : d)));
    const actor = users.find(u => u.role === activeRole)?.name || 'DPO';
    addPlatformLog(actor, `Updated DPIA dossier: ${updatedDpia.activityName}`, 'DPIA');
    showToast(currentLanguage === 'pl' ? `Uaktualniono analizę DPIA dla ${updatedDpia.activityName}` : `DPIA updated successfully for ${updatedDpia.activityName}`, 'success');
  };

  const addIncident = (inc: Omit<Incident, 'id' | 'timerDeadline' | 'status' | 'timeline'>) => {
    const newId = `inc-${new Date().getFullYear()}-${incidents.length + 1}`;
    const timerDeadline = new Date(new Date().getTime() + 72 * 60 * 60 * 1000).toISOString(); // strict 72h clock
    const newIncident: Incident = {
      ...inc,
      id: newId,
      timerDeadline,
      status: 'triage',
      timeline: [
        {
          id: 't-init',
          actor: inc.reporter,
          action: 'Incident Intake logged',
          date: new Date().toISOString(),
          description: `Breach registered. Core affected categories: ${Array.isArray(inc.affectedData) ? inc.affectedData.join(', ') : inc.affectedData}`
        }
      ]
    };
    setIncidents((prev) => [newIncident, ...prev]);
    addPlatformLog(inc.reporter, `Logged cybersecurity/privacy incident: ${inc.title}`, 'INCIDENT');
    addNotification('RODO Breach Countdown Active', `A reportable incident "${inc.title}" has been registered. 72h clock active.`, 'alert');
    showToast(currentLanguage === 'pl' ? `Zarejestrowano naruszenie: ${inc.title}` : `Incident successfully logged: ${inc.title}`, 'success');
    return newId;
  };

  const updateIncident = (updatedInc: Incident) => {
    setIncidents((prev) => prev.map((i) => (i.id === updatedInc.id ? updatedInc : i)));
    showToast(currentLanguage === 'pl' ? `Uaktualniono status naruszenia: ${updatedInc.title}` : `Incident updated successfully: ${updatedInc.title}`, 'success');
  };

  const addDsarRequest = (req: Omit<DSARRequest, 'id' | 'status' | 'verificationChecked' | 'collectionTasks' | 'responseText' | 'submittedDate'>) => {
    const newId = `dsar-${400 + requests.length + 1}`;
    const deadline = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 1-month legal SLA
    const newRequest: DSARRequest = {
      ...req,
      id: newId,
      status: 'identity_verified',
      verificationChecked: true,
      verificationMethod: 'MFA Email verification checked automatically',
      submittedDate: new Date().toISOString().split('T')[0],
      deadline,
      collectionTasks: [
        { id: Math.random().toString(), title: 'Search primary email indexing engines', owner: 'Karolina Wójcik', status: 'pending' },
        { id: Math.random().toString(), title: 'Check CRM database contact logs', owner: 'Marek Mazur', status: 'pending' }
      ],
      responseText: `Szanowny Panie / Szanowna Pani,\n\nW nawiązaniu do wniosku o realizację praw na podstawie RODO, przekazujemy informacje o statusie wyszukiwania danych...`
    };
    setRequests((prev) => [newRequest, ...prev]);
    addNotification('New DSAR Request Received', `A data subject request (${req.requestType}) was submitted by ${req.requesterName}.`, 'warning');
    showToast(currentLanguage === 'pl' ? `Otrzymano wniosek RODO od ${req.requesterName}` : `RODO data subject request logged for ${req.requesterName}`, 'success');
    return newId;
  };

  const updateDsarRequest = (updatedReq: DSARRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updatedReq.id ? updatedReq : r)));
    showToast(`DSAR request dossier updated`, 'success');
  };

  const addVendor = (vend: Omit<Vendor, 'id' | 'questionnaireCompleted'>) => {
    const newId = `v-${vendors.length + 1}`;
    const newVendor: Vendor = {
      ...vend,
      id: newId,
      questionnaireCompleted: false
    };
    setVendors((prev) => [newVendor, ...prev]);
    showToast(`Vendor ${vend.name} registered`, 'success');
    return newId;
  };

  const updateVendor = (updatedVendor: Vendor) => {
    setVendors((prev) => prev.map((v) => (v.id === updatedVendor.id ? updatedVendor : v)));
    showToast(`Vendor details updated: ${updatedVendor.name}`, 'success');
  };

  const addAudit = (aud: Omit<Audit, 'id' | 'status' | 'findings' | 'evidenceCount'>) => {
    const newId = `aud-${2026}-${audits.length + 1}`;
    const newAudit: Audit = {
      ...aud,
      id: newId,
      status: 'draft',
      evidenceCount: aud.evidenceList.length,
      findings: []
    };
    setAudits((prev) => [newAudit, ...prev]);
    showToast(`Compliance audit scope created: ${aud.title}`, 'success');
    return newId;
  };

  const updateAudit = (updatedAudit: Audit) => {
    setAudits((prev) => prev.map((a) => (a.id === updatedAudit.id ? updatedAudit : a)));
    showToast(`Audit dossier updated`, 'success');
  };

  const addTask = (tsk: Omit<Task, 'id'>) => {
    const newId = `task-${Math.floor(100 + Math.random() * 900)}`;
    const newTask: Task = { ...tsk, id: newId };
    setTasks((prev) => [newTask, ...prev]);
    return newId;
  };

  const toggleTaskStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const newStatus = t.status === 'done' ? 'todo' : 'done';
          showToast(newStatus === 'done' ? `Task completed: ${t.title}` : `Task reopened`, 'success');
          return { ...t, status: newStatus as any };
        }
        return t;
      })
    );
  };

  const addNotification = (title: string, message: string, type: 'info' | 'warning' | 'alert' | 'success') => {
    const newNot: Notification = {
      id: `not-${Date.now()}`,
      title,
      message,
      date: 'Just now',
      read: false,
      type
    };
    setNotifications((prev) => [newNot, ...prev]);
  };

  const markNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast('Notifications marked as read', 'info');
  };

  const addPlatformLog = (actor: string, action: string, target: string) => {
    const newLog = {
      timestamp: new Date().toISOString(),
      actor,
      action,
      target,
      status: 'success'
    };
    setPlatformLogs((prev) => [newLog, ...prev]);
  };

  const addSupportTicket = (ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>) => {
    const newId = `tick-${Math.floor(200 + Math.random() * 100)}`;
    const newTicket: SupportTicket = {
      ...ticket,
      id: newId,
      createdAt: new Date().toISOString(),
      status: 'open'
    };
    setTickets((prev) => [newTicket, ...prev]);
    showToast(`Platform support ticket issued. ID: ${newId}`, 'success');
  };

  return (
    <AppContext.Provider
      value={{
        tenants,
        users,
        activities,
        dpias,
        risks,
        vendors,
        transfers,
        incidents,
        requests,
        audits,
        tasks,
        notifications,
        tickets,
        platformLogs,
        selectedTenantId,
        activeRole,
        currentLanguage,
        currentHash,
        navigateTo,
        showCommandPalette,
        setShowCommandPalette,
        showNotificationDrawer,
        setShowNotificationDrawer,
        switchTenant,
        switchRole,
        switchLanguage,
        addActivity,
        updateActivity,
        deleteActivity,
        addDpia,
        updateDpia,
        addIncident,
        updateIncident,
        addDsarRequest,
        updateDsarRequest,
        addVendor,
        updateVendor,
        addAudit,
        updateAudit,
        addTask,
        toggleTaskStatus,
        addNotification,
        markNotificationsAsRead,
        addPlatformLog,
        addSupportTicket,
        toasts,
        showToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
