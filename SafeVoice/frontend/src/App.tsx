/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldAlert, Lock, AlertOctagon, Info,
  ExternalLink, LogIn, Database, RefreshCw, Layers
} from "lucide-react";
import {
  AppRole, CaseReport, CaseMessage, AuditLog,
  SaaSUser, NotificationItem, ReportCategory, CaseStatus, CaseSeverity
} from "./types";
import { SafeVoiceDb } from "./data/mockData";
import { AppSidebar, AppNavbar } from "./components/Navigation";
import {
  PublicReportPortal, ReportSuccessView, TrackCaseView,
  AdminDashboard, CaseManagementGrid, CaseDetailsView,
  CentralEncryptedInbox, SecurityAuditTrailLogs,
  UsersPermissionsMatrix, BrandedSettingsView
} from "./components/Views";

export default function App() {
  // Sync state with url hash router
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const hash = window.location.hash.replace("#", "");
    return hash || "/report";
  });

  // Hot Reload / state variables
  const [reports, setReports] = useState<CaseReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [users, setUsers] = useState<SaaSUser[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  
  // Simulated Roles for interactive client-testing!
  const [activeRole, setActiveRole] = useState<AppRole | "Public User">("Compliance Officer");
  
  // Cache for success page
  const [lastSuccessPin, setLastSuccessPin] = useState<string | undefined>("");
  const [lastSuccessCategory, setLastSuccessCategory] = useState<ReportCategory>(ReportCategory.Corruption);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Initialize DB on mount
  useEffect(() => {
    setReports(SafeVoiceDb.getReports());
    setAuditLogs(SafeVoiceDb.getAuditLogs());
    setMessages(SafeVoiceDb.getMessages());
    setUsers(SafeVoiceDb.getUsers());
    setNotifications(SafeVoiceDb.getNotifications());
  }, []);

  // Sync hash routing changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        // Handle sub-routing checks like cases/SV-2026-001
        if (hash.startsWith("/cases/")) {
          const id = hash.replace("/cases/", "");
          setSelectedCaseId(id);
          setCurrentPath("/cases/:id");
        } else {
          setCurrentPath(hash);
        }
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateTo = (path: string) => {
    window.location.hash = path;
    setCurrentPath(path);
  };

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    navigateTo(`/cases/${caseId}`);
  };

  // Re-write State & DB Synchronizers
  const reloadFromDb = () => {
    setReports(SafeVoiceDb.getReports());
    setAuditLogs(SafeVoiceDb.getAuditLogs());
    setMessages(SafeVoiceDb.getMessages());
    setUsers(SafeVoiceDb.getUsers());
    setNotifications(SafeVoiceDb.getNotifications());
  };

  // 1. Submit report handler
  const handleFormReportSubmit = (data: Omit<CaseReport, "id" | "status" | "submissionDate" | "timeline" | "severity">) => {
    const generatedId = `SV-${new Date().getFullYear()}-${Math.floor(Math.random() * 899 + 100)}`;
    
    let generatedPin: string | undefined = undefined;
    const isLabourDispute = data.category === ReportCategory.LabourDispute;

    if (!isLabourDispute) {
      generatedPin = `SV-${Math.floor(Math.random() * 8999 + 1000)}-${Math.floor(Math.random() * 8999 + 1000)}`;
    }

    const newReport: CaseReport = {
      id: generatedId,
      trackingPin: generatedPin,
      category: data.category,
      description: data.description,
      incidentDate: data.incidentDate,
      department: data.department,
      attachments: data.attachments,
      status: "Received",
      severity: isLabourDispute ? "Medium" : "High",
      submissionDate: new Date().toISOString().replace("T", " ").substring(0, 16),
      isAnonymous: data.isAnonymous,
      reporterName: data.reporterName,
      reporterEmail: data.reporterEmail,
      assignedInvestigator: isLabourDispute ? "Katarzyna Mazur" : undefined, // Labor dispute goes straight to HR
      slaHoursRemaining: 2160,
      timeline: [
        {
          id: `tem-n-${Date.now()}`,
          title: isLabourDispute ? "Labour Dispute Submitted & Routed to HR" : "Anonymous Report Received",
          description: isLabourDispute 
            ? "Report bypassed cryptographic tracking triggers and was forwarded directly to HR Desk."
            : "Data package securely stored and AES encryption shields initialized.",
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
          type: "system"
        }
      ]
    };

    // Update DB
    const allReports = [newReport, ...reports];
    SafeVoiceDb.saveReports(allReports);

    // Save initial system message if secure PIN activated
    if (generatedPin) {
      const activeMsgs = SafeVoiceDb.getMessages();
      const initialSystemMsg: CaseMessage = {
        id: `msg-sys-${Date.now()}`,
        caseId: generatedId,
        sender: "System",
        text: `Secure encrypted bridge established. Communication tunnel verified. The appointed investigator will update you in accordance with the 7-day Polish Compliance Directive SLA.`,
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
        attachments: []
      };
      SafeVoiceDb.saveMessages([initialSystemMsg, ...activeMsgs]);
    }

    // Push system notifications
    const allNotifs = SafeVoiceDb.getNotifications();
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: isLabourDispute ? "HR Dispute Received" : "Critical Whistleblower Incident Submitted",
      description: `New Case ID ${generatedId} submitted under category ${data.category}.`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      read: false,
      type: "new_report",
      caseId: generatedId
    };
    SafeVoiceDb.saveNotifications([newNotif, ...allNotifs]);

    // Audit logs entry
    SafeVoiceDb.addAuditLog(
      "Public Gateway Portal",
      `Created Case entry ${generatedId} under Whistleblower Protection Code. Compliance tracking initialized.`
    );

    // Refresh application states
    reloadFromDb();
    setLastSuccessPin(generatedPin);
    setLastSuccessCategory(data.category);
    
    navigateTo("/report/success");
  };

  // 2. Add follower text messages by Reporter
  const handleReporterMessageSubmit = (caseId: string, text: string) => {
    const allMsgs = SafeVoiceDb.getMessages();
    const msgTime = new Date().toISOString().replace("T", " ").substring(0, 16);
    
    const newMsg: CaseMessage = {
      id: `msg-rep-${Date.now()}`,
      caseId,
      sender: "Reporter",
      text,
      timestamp: msgTime,
    };
    SafeVoiceDb.saveMessages([newMsg, ...allMsgs]);

    // Appended timeline
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((r) => r.id === caseId);
    if (target) {
      target.timeline.unshift({
        id: `tl-rep-${Date.now()}`,
        title: "Whistleblower follow-up posted",
        description: "Anonymous reporter sent new information update over cryptographic tunnel.",
        timestamp: msgTime,
        type: "message"
      });
      SafeVoiceDb.saveReports(allReports);
    }

    // Logs & Alerts
    SafeVoiceDb.addAuditLog("Public Portal", `Reporter submitted follow-up message clarification for Case ${caseId}.`);
    
    const allNotifs = SafeVoiceDb.getNotifications();
    SafeVoiceDb.saveNotifications([
      {
        id: `notif-chat-${Date.now()}`,
        title: "Secured follow-up submitted",
        description: `Anonymous reporter posted message update on Case ${caseId}.`,
        timestamp: msgTime,
        read: false,
        type: "message",
        caseId
      },
      ...allNotifs
    ]);

    reloadFromDb();
  };

  // 3. Add supplemental files by Reporter
  const handleReporterEvidenceSubmit = (caseId: string, fileName: string) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((r) => r.id === caseId);
    if (target) {
      if (!target.attachments.includes(fileName)) {
        target.attachments.push(fileName);
        SafeVoiceDb.saveReports(allReports);
        SafeVoiceDb.addAuditLog("Public Portal", `Supplemental whistleblower evidence package received: ${fileName} on Case ${caseId}.`);
        reloadFromDb();
      }
    }
  };

  // 4. Update Case status by back-office Compliance Admin
  const handleUpdateCaseStatus = (caseId: string, status: CaseStatus) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((r) => r.id === caseId);
    if (target) {
      const oldVal = target.status;
      target.status = status;
      
      const logTime = new Date().toISOString().replace("T", " ").substring(0, 16);
      target.timeline.unshift({
        id: `tl-stat-${Date.now()}`,
        title: "Case status modified",
        description: `Status updated from '${oldVal}' to '${status}' by authorized Officer (${activeRole}).`,
        timestamp: logTime,
        type: "status"
      });
      SafeVoiceDb.saveReports(allReports);

      SafeVoiceDb.addAuditLog(
        `${activeRole} (${users.find((u) => u.role === activeRole)?.name || "Officer"})`,
        `Changed Case status SV-XXX on system files.`,
        "83.144.92.12",
        oldVal,
        status
      );

      reloadFromDb();
    }
  };

  // 5. Update case severity by back-office Admin
  const handleUpdateCaseSeverity = (caseId: string, severity: CaseSeverity) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((r) => r.id === caseId);
    if (target) {
      const oldVal = target.severity;
      target.severity = severity;
      
      const logTime = new Date().toISOString().replace("T", " ").substring(0, 16);
      target.timeline.unshift({
        id: `tl-sev-${Date.now()}`,
        title: "Incident severity classification changed",
        description: `Severity adjusted to '${severity}' profile by authorized Officer.`,
        timestamp: logTime,
        type: "system"
      });
      SafeVoiceDb.saveReports(allReports);
      SafeVoiceDb.addAuditLog(`${activeRole}`, `Adjusted Case ${caseId} severity tier from '${oldVal}' to '${severity}'.`);
      reloadFromDb();
    }
  };

  // 6. Assign investigator to incident case
  const handleAssignInvestigator = (caseId: string, investigatorName: string) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((r) => r.id === caseId);
    if (target) {
      target.assignedInvestigator = investigatorName || undefined;
      const logTime = new Date().toISOString().replace("T", " ").substring(0, 16);
      target.timeline.unshift({
        id: `tl-assign-${Date.now()}`,
        title: "Investigator assigned",
        description: investigatorName 
          ? `Compliance officer ${investigatorName} assigned to oversee the case directive.`
          : "Case investigator unassigned.",
        timestamp: logTime,
        type: "system"
      });
      SafeVoiceDb.saveReports(allReports);
      SafeVoiceDb.addAuditLog(`${activeRole}`, `Assigned investigator ${investigatorName || "None"} to Case ${caseId}.`);
      reloadFromDb();
    }
  };

  // 7. Add internal discussion notes
  const handleAddInternalNote = (caseId: string, text: string) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((r) => r.id === caseId);
    if (target) {
      const author = users.find((u) => u.role === activeRole)?.name || "System Officer";
      const logTime = new Date().toISOString().replace("T", " ").substring(0, 16);
      target.timeline.unshift({
        id: `tl-note-${Date.now()}`,
        title: "Internal Investigation Note Posted",
        description: `[RESTRICTED NOTE] by ${author} (${activeRole}): ${text}`,
        timestamp: logTime,
        type: "comment"
      });
      SafeVoiceDb.saveReports(allReports);
      SafeVoiceDb.addAuditLog(`${activeRole}`, `Posted private investigator note on case SV-XXX.`);
      reloadFromDb();
    }
  };

  // 8. Add admin chat reply directly over anonymous messenger tunnel
  const handleAddAdminReplyMessage = (caseId: string, text: string) => {
    const allMsgs = SafeVoiceDb.getMessages();
    const replyTime = new Date().toISOString().replace("T", " ").substring(0, 16);
    const authorRole = activeRole === "Public User" ? "Compliance Officer" : activeRole;

    const newMsg: CaseMessage = {
      id: `msg-admin-${Date.now()}`,
      caseId,
      sender: authorRole as any,
      text,
      timestamp: replyTime,
      readByReporter: false,
      readByAdmin: true
    };
    SafeVoiceDb.saveMessages([newMsg, ...allMsgs]);

    // Append case Timeline
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((r) => r.id === caseId);
    if (target) {
      target.timeline.unshift({
        id: `tl-reply-${Date.now()}`,
        title: "Compliance reply posted",
        description: `Official outreach post transmitted over secure tunnel link by Investigator team.`,
        timestamp: replyTime,
        type: "message"
      });
      SafeVoiceDb.saveReports(allReports);
    }

    SafeVoiceDb.addAuditLog(`${authorRole}`, `Dispatched reply outreach statement to Whistleblower case ${caseId}.`);
    reloadFromDb();
  };

  // 9. Invite / Authorize new officer
  const handleInviteOfficerObj = (name: string, email: string, role: AppRole) => {
    const activeUsrs = SafeVoiceDb.getUsers();
    const newUsr: SaaSUser = {
      id: `usr-${Date.now()}`,
      name,
      email,
      role,
      status: "Pending",
      joinedDate: new Date().toISOString().split("T")[0]
    };
    SafeVoiceDb.saveUsers([...activeUsrs, newUsr]);

    // Logs & Notifs
    SafeVoiceDb.addAuditLog(`${activeRole}`, `Authorized and invited compliance investigator ${name} (${role}) to RegulaOne SafeVoice tenant.`);
    
    const allNotifs = SafeVoiceDb.getNotifications();
    SafeVoiceDb.saveNotifications([
      {
        id: `notif-inv-${Date.now()}`,
        title: "Officer invite issued",
        description: `Authorization credentials sent to ${email} as ${role}.`,
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
        read: false,
        type: "update"
      },
      ...allNotifs
    ]);

    reloadFromDb();
  };

  const handleMarkAllAlertsRead = () => {
    const list = SafeVoiceDb.getNotifications().map((n) => ({ ...n, read: true }));
    SafeVoiceDb.saveNotifications(list);
    reloadFromDb();
  };

  // Determine current active case model for detail router
  const currentDetailsCase = selectedCaseId
    ? reports.find((r) => r.id === selectedCaseId)
    : null;

  // Verification helper for evaluate mode
  const isPublicUser = activeRole === "Public User";

  return (
    <div className="bg-[#0B0C10] text-[#E2E8F0] font-sans min-h-screen flex antialiased">
      {/* 1. App Navigation Sidebar */}
      <AppSidebar
        currentPath={currentPath}
        onNavigate={(path) => {
          // If Public User tries to click Backoffice panels, automatically guide them to simulate Admin!
          if (isPublicUser && !["/report", "/track", "/report/success"].includes(path)) {
            setActiveRole("Compliance Officer");
          }
          navigateTo(path);
        }}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        unreadCount={messages.length}
      />

      {/* Main Container workspace */}
      <div className="flex-grow flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Navbar Header */}
        <AppNavbar
          activeRole={activeRole}
          setActiveRole={(r) => {
            setActiveRole(r);
            // Automatically update current navigation panels depending on chosen focus
            if (r === "Public User") {
              if (currentPath !== "/track" && currentPath !== "/report/success") {
                navigateTo("/report");
              }
            } else {
              if (currentPath === "/report" || currentPath === "/report/success") {
                navigateTo("/dashboard");
              }
            }
          }}
          notifications={notifications}
          onMarkAllRead={handleMarkAllAlertsRead}
        />

        {/* Informative Guidance Banner during User Test Mode */}
        {isPublicUser && !["/report", "/track", "/report/success"].includes(currentPath) && (
          <div className="bg-gradient-to-r from-indigo-950/70 to-slate-900 border-b border-indigo-500/10 px-6 py-2.5 text-xs text-indigo-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                <strong>SIMULATOR TIP:</strong> You are accessing backoffice dashboards. We have upgraded your simulator role to <strong>Compliance Officer</strong> to let you process database entries dynamically!
              </span>
            </div>
            <button
              onClick={() => setActiveRole("Compliance Officer")}
              className="bg-indigo-600 text-white font-mono font-black px-2.5 py-1 rounded text-[10px] uppercase cursor-pointer hover:bg-indigo-500 transition-colors"
            >
              Verify Active
            </button>
          </div>
        )}

        {/* Primary Page Canvas */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20">
          <AnimatePresence mode="wait">
            {currentPath === "/report" && (
              <motion.div
                key="report"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <PublicReportPortal onSubmitReport={handleFormReportSubmit} />
              </motion.div>
            )}

            {currentPath === "/report/success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <ReportSuccessView generatedPin={lastSuccessPin} category={lastSuccessCategory} />
              </motion.div>
            )}

            {currentPath === "/track" && (
              <motion.div
                key="track"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <TrackCaseView
                  reports={reports}
                  messages={messages}
                  onAddMessage={handleReporterMessageSubmit}
                  onAddEvidence={handleReporterEvidenceSubmit}
                />
              </motion.div>
            )}

            {currentPath === "/dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <AdminDashboard
                  reports={reports}
                  activeRole={activeRole}
                  onNavigateToCases={() => navigateTo("/cases")}
                />
              </motion.div>
            )}

            {currentPath === "/cases" && (
              <motion.div
                key="cases"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <CaseManagementGrid reports={reports} onSelectCase={handleSelectCase} />
              </motion.div>
            )}

            {currentPath === "/cases/:id" && currentDetailsCase && (
              <motion.div
                key={`case-detail-${selectedCaseId}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <CaseDetailsView
                  caseItem={currentDetailsCase}
                  messages={messages}
                  users={users}
                  onUpdateStatus={handleUpdateCaseStatus}
                  onUpdateSeverity={handleUpdateCaseSeverity}
                  onAssignInvestigator={handleAssignInvestigator}
                  onAddInternalNote={handleAddInternalNote}
                  onAddAdminMessage={handleAddAdminReplyMessage}
                />
              </motion.div>
            )}

            {currentPath === "/messages" && (
              <motion.div
                key="messages"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <CentralEncryptedInbox
                  reports={reports}
                  messages={messages}
                  onAddAdminMessage={handleAddAdminReplyMessage}
                />
              </motion.div>
            )}

            {currentPath === "/audits" && (
              <motion.div
                key="audits"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <SecurityAuditTrailLogs logs={auditLogs} />
              </motion.div>
            )}

            {currentPath === "/users" && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <UsersPermissionsMatrix users={users} onInviteUser={handleInviteOfficerObj} />
              </motion.div>
            )}

            {currentPath === "/settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <BrandedSettingsView />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
