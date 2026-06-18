import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { Info } from "lucide-react";
import {
  AppRole,
  AuditLog,
  CaseMessage,
  CaseReport,
  CaseSeverity,
  CaseStatus,
  EvidenceAttachment,
  NotificationItem,
  ReportCategory,
  ReportSubmission,
  SaaSUser
} from "./types";
import { reporterMetadataPolicy, SafeVoiceDb } from "./data/mockData";
import { useJurisdiction } from "./config/activeJurisdiction";
import { useMotionProps } from "./a11y/motion";
import { AppNavbar, AppSidebar } from "./components/Navigation";
import {
  AccessDeniedView,
  AdminDashboard,
  BrandedSettingsView,
  CaseDetailsView,
  CaseManagementGrid,
  CentralEncryptedInbox,
  PublicReportPortal,
  ReportSuccessView,
  SecurityAuditTrailLogs,
  TrackCaseView,
  UsersPermissionsMatrix
} from "./components/Views";

const nowStamp = () => new Date().toISOString().replace("T", " ").substring(0, 16);

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().replace("T", " ").substring(0, 16);
};

const addMonths = (months: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().replace("T", " ").substring(0, 16);
};

// Build the deletion date from the jurisdiction's retention period (e.g. Poland: 3 years).
const retentionDate = (years: number) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return `${date.getFullYear()}-12-31`;
};

const randomPart = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint8Array(4);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
};

const createCaseId = () => {
  const values = new Uint16Array(1);
  window.crypto.getRandomValues(values);
  return `SV-${new Date().getFullYear()}-${String((values[0] % 900) + 100).padStart(3, "0")}`;
};

const createTrackingCode = () => `SV-${randomPart()}-${randomPart()}`;

const routeFromHash = () => {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "/report";
};

const severityFor = (category: ReportCategory): CaseSeverity => {
  if ([ReportCategory.Corruption, ReportCategory.Fraud, ReportCategory.PublicProcurement].includes(category)) return "Critical";
  if ([ReportCategory.DataProtection, ReportCategory.Cybersecurity, ReportCategory.AML].includes(category)) return "High";
  if (category === ReportCategory.LabourDispute) return "Medium";
  return "Medium";
};

export default function App() {
  const { t } = useTranslation();
  const jurisdiction = useJurisdiction();
  const m = useMotionProps();
  const [currentPath, setCurrentPath] = useState<string>(() => routeFromHash());
  const [reports, setReports] = useState<CaseReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [users, setUsers] = useState<SaaSUser[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | "Public User">("Public User");
  const [lastSuccessCode, setLastSuccessCode] = useState<string | undefined>("");
  const [lastSuccessCategory, setLastSuccessCategory] = useState<ReportCategory>(ReportCategory.Corruption);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  useEffect(() => {
    SafeVoiceDb.ensureSeeded();
    reloadFromDb();
  }, []);

  useEffect(() => {
    const syncRoute = () => {
      const hash = routeFromHash();
      if (hash.startsWith("/cases/")) {
        setSelectedCaseId(hash.replace("/cases/", ""));
        setCurrentPath("/cases/:id");
      } else {
        setCurrentPath(hash);
      }
    };

    const handleHashChange = () => {
      const hash = routeFromHash();
      if (hash.startsWith("/cases/")) {
        setSelectedCaseId(hash.replace("/cases/", ""));
        setCurrentPath("/cases/:id");
      } else {
        setCurrentPath(hash);
      }
    };
    syncRoute();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Keep the browser tab title in step with the current screen and language. A descriptive,
  // per-page title helps screen-reader users know where they are (WCAG 2.4.2).
  useEffect(() => {
    const sectionKeys: Record<string, string> = {
      "/report": "nav.submitReport",
      "/report/success": "nav.submitReport",
      "/track": "nav.trackReport",
      "/access-denied": "accessDenied.title",
      "/dashboard": "nav.caseOperations",
      "/cases": "nav.caseRegister",
      "/cases/:id": "nav.caseRegister",
      "/messages": "nav.secureInbox",
      "/audits": "nav.auditTrail",
      "/users": "nav.accessControls",
      "/settings": "nav.complianceSettings"
    };
    const key = sectionKeys[currentPath];
    document.title = key ? `${t(key)} · ${t("app.name")}` : t("app.documentTitle");
  }, [currentPath, t]);

  const reloadFromDb = () => {
    setReports(SafeVoiceDb.getReports());
    setAuditLogs(SafeVoiceDb.getAuditLogs());
    setMessages(SafeVoiceDb.getMessages());
    setUsers(SafeVoiceDb.getUsers());
    setNotifications(SafeVoiceDb.getNotifications());
  };

  const navigateTo = (path: string) => {
    if (window.location.hash !== `#${path}`) {
      window.location.hash = path;
    }
    setCurrentPath(path);
  };

  const setRole = (role: AppRole | "Public User") => {
    setActiveRole(role);
    if (role === "Public User" && !["/report", "/track", "/report/success", "/access-denied"].includes(currentPath)) {
      navigateTo("/report");
    }
    if (role !== "Public User" && currentPath === "/access-denied") {
      navigateTo("/dashboard");
    }
  };

  const activeUser = useMemo(
    () => (activeRole === "Public User" ? undefined : users.find((user) => user.role === activeRole)),
    [activeRole, users]
  );

  const currentDetailsCase = selectedCaseId ? reports.find((report) => report.id === selectedCaseId) : null;

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    navigateTo(`/cases/${caseId}`);
  };

  const handleFormReportSubmit = (data: ReportSubmission) => {
    const isHrHandoff = data.category === ReportCategory.LabourDispute;
    const generatedId = createCaseId();
    const generatedTrackingCode = isHrHandoff ? undefined : createTrackingCode();
    const submissionDate = nowStamp();
    const disclosureMode = isHrHandoff ? "HR Handoff" : data.disclosureMode;

    const newReport: CaseReport = {
      id: generatedId,
      trackingCode: generatedTrackingCode,
      category: data.category,
      description: data.description,
      incidentDate: data.incidentDate,
      department: data.department,
      attachments: data.attachments,
      status: "Received",
      severity: severityFor(data.category),
      submissionDate,
      acknowledgementDue: addDays(jurisdiction.acknowledgementDays),
      feedbackDue: addMonths(jurisdiction.feedbackMonths),
      assignedInvestigator: isHrHandoff ? "Katarzyna Mazur" : undefined,
      disclosureMode,
      contactVaultRef: disclosureMode === "Confidential Named" ? data.contactVaultRef : undefined,
      intakeChannel: isHrHandoff ? "HR grievance handoff" : "Anonymous web portal",
      lawfulBasis: isHrHandoff
        ? "Internal HR grievance procedure; no SafeVoice anonymous tracking code issued"
        : `Legal obligation and legitimate follow-up under ${jurisdiction.legalBasisLabel}`,
      controller: jurisdiction.controllerName,
      processor: isHrHandoff ? "Internal HR desk" : jurisdiction.processorName,
      slaHoursRemaining: 2160,
      technicalMetadataPolicy: reporterMetadataPolicy,
      retention: {
        state: "Active",
        retentionYears: jurisdiction.retentionYears,
        deleteAfter: retentionDate(jurisdiction.retentionYears),
        irrelevantPersonalDataDeletionDue: addDays(jurisdiction.irrelevantDataDeletionDays)
      },
      riskFlags: isHrHandoff
        ? ["Outside whistleblower scope", "HR confidentiality required"]
        : ["Anonymous channel", "Anti-retaliation", "Metadata minimisation"],
      timeline: [
        {
          id: `tl-${Date.now()}`,
          title: isHrHandoff ? "HR grievance handoff recorded" : "Anonymous report received",
          description: isHrHandoff
            ? "No tracking code was generated. The workflow separates HR grievances from the whistleblower channel."
            : "Report accepted without storing reporter IP, user-agent, device fingerprint, browser fingerprint, or geolocation.",
          timestamp: submissionDate,
          type: "system"
        },
        {
          id: `tl-del-${Date.now()}`,
          title: "Irrelevant data deletion timer started",
          description: "Any accidentally collected non-relevant personal data must be removed within 14 days of discovery.",
          timestamp: submissionDate,
          type: "retention"
        }
      ]
    };

    SafeVoiceDb.saveReports([newReport, ...reports]);

    if (generatedTrackingCode) {
      SafeVoiceDb.saveMessages([
        {
          id: `msg-sys-${Date.now()}`,
          caseId: generatedId,
          sender: "System",
          text: "Your report has been received. Use this anonymous channel for acknowledgement, follow-up questions, and final feedback.",
          timestamp: submissionDate,
          attachments: []
        },
        ...SafeVoiceDb.getMessages()
      ]);
    }

    SafeVoiceDb.saveNotifications([
      {
        id: `notif-${Date.now()}`,
        title: isHrHandoff ? "HR grievance handoff" : "New minimized report",
        description: `${generatedId} submitted. Reporter technical metadata is not exposed to administrators.`,
        timestamp: submissionDate,
        read: false,
        type: "new_report",
        caseId: generatedId
      },
      ...SafeVoiceDb.getNotifications()
    ]);

    SafeVoiceDb.addAuditLog({
      actorRole: "Public Portal",
      actorRef: "anonymous-intake",
      actionType: "REPORT_RECEIVED",
      subjectId: generatedId,
      outcome: "Recorded",
      metadataNotice: "Reporter network and device metadata were not collected for case handling."
    });

    reloadFromDb();
    setLastSuccessCode(generatedTrackingCode);
    setLastSuccessCategory(data.category);
    navigateTo("/report/success");
  };

  const handleReporterMessageSubmit = (caseId: string, text: string) => {
    const msgTime = nowStamp();
    SafeVoiceDb.saveMessages([
      {
        id: `msg-rep-${Date.now()}`,
        caseId,
        sender: "Reporter",
        text,
        timestamp: msgTime
      },
      ...SafeVoiceDb.getMessages()
    ]);

    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (target) {
      target.timeline.unshift({
        id: `tl-rep-${Date.now()}`,
        title: "Reporter follow-up received",
        description: "Additional information posted through the anonymous communication channel.",
        timestamp: msgTime,
        type: "message"
      });
      target.status = target.status === "Received" ? "Acknowledged" : target.status;
      SafeVoiceDb.saveReports(allReports);
    }

    SafeVoiceDb.addAuditLog({
      actorRole: "Public Portal",
      actorRef: "anonymous-tracking-channel",
      actionType: "MESSAGE_POSTED",
      subjectId: caseId,
      outcome: "Recorded",
      metadataNotice: "Reporter message accepted without network or device identifiers."
    });
    reloadFromDb();
  };

  const handleReporterEvidenceSubmit = (caseId: string, attachments: EvidenceAttachment[]) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (!target) return;

    const existing = new Set(target.attachments.map((attachment) => attachment.id));
    const additions = attachments.filter((attachment) => !existing.has(attachment.id));
    if (additions.length === 0) return;

    target.attachments = [...target.attachments, ...additions];
    target.timeline.unshift({
      id: `tl-ev-${Date.now()}`,
      title: "Supplemental evidence added",
      description: `${additions.length} evidence reference(s) added after file-type validation, malware scan, and metadata stripping.`,
      timestamp: nowStamp(),
      type: "attachment"
    });
    SafeVoiceDb.saveReports(allReports);
    SafeVoiceDb.addAuditLog({
      actorRole: "Public Portal",
      actorRef: "anonymous-tracking-channel",
      actionType: "EVIDENCE_ADDED",
      subjectId: caseId,
      outcome: "Recorded",
      metadataNotice: "Original filenames are not shown to administrators."
    });
    reloadFromDb();
  };

  const handleUpdateCaseStatus = (caseId: string, status: CaseStatus) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (!target) return;

    const oldValue = target.status;
    target.status = status;
    target.timeline.unshift({
      id: `tl-stat-${Date.now()}`,
      title: "Case status changed",
      description: `Status changed from ${oldValue} to ${status}.`,
      timestamp: nowStamp(),
      type: "status"
    });
    if (status === "Closed" && target.retention.state !== "Legal Hold") {
      target.retention.state = "Deletion Scheduled";
    }
    SafeVoiceDb.saveReports(allReports);
    SafeVoiceDb.addAuditLog({
      actorRole: activeRole === "Public User" ? "System" : activeRole,
      actorRef: activeUser?.id || "system",
      actionType: "CASE_STATUS_CHANGED",
      subjectId: caseId,
      outcome: SafeVoiceDb.can((activeRole as AppRole) || "Auditor", "closeCases") ? "Allowed" : "Recorded",
      oldValue,
      newValue: status,
      metadataNotice: "Audit entry contains case state only, not reporter identity or technical metadata."
    });
    reloadFromDb();
  };

  const handleUpdateCaseSeverity = (caseId: string, severity: CaseSeverity) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (!target) return;

    const oldValue = target.severity;
    target.severity = severity;
    target.timeline.unshift({
      id: `tl-sev-${Date.now()}`,
      title: "Severity changed",
      description: `Severity changed from ${oldValue} to ${severity}.`,
      timestamp: nowStamp(),
      type: "status"
    });
    SafeVoiceDb.saveReports(allReports);
    SafeVoiceDb.addAuditLog({
      actorRole: activeRole === "Public User" ? "System" : activeRole,
      actorRef: activeUser?.id || "system",
      actionType: "SEVERITY_CHANGED",
      subjectId: caseId,
      outcome: "Allowed",
      oldValue,
      newValue: severity,
      metadataNotice: "No reporter metadata is present in this audit event."
    });
    reloadFromDb();
  };

  const handleAssignInvestigator = (caseId: string, investigatorName: string) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (!target) return;

    const oldValue = target.assignedInvestigator || "Unassigned";
    target.assignedInvestigator = investigatorName || undefined;
    target.timeline.unshift({
      id: `tl-assign-${Date.now()}`,
      title: "Investigator assignment changed",
      description: investigatorName
        ? `${investigatorName} assigned under written confidentiality duties.`
        : "Investigator removed from case.",
      timestamp: nowStamp(),
      type: "system"
    });
    SafeVoiceDb.saveReports(allReports);
    SafeVoiceDb.addAuditLog({
      actorRole: activeRole === "Public User" ? "System" : activeRole,
      actorRef: activeUser?.id || "system",
      actionType: "INVESTIGATOR_ASSIGNED",
      subjectId: caseId,
      outcome: "Allowed",
      oldValue,
      newValue: investigatorName || "Unassigned",
      metadataNotice: "Assignment event excludes reporter identity and network metadata."
    });
    reloadFromDb();
  };

  const handleAddInternalNote = (caseId: string, text: string) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (!target) return;

    target.timeline.unshift({
      id: `tl-note-${Date.now()}`,
      title: "Restricted investigation note",
      description: text,
      timestamp: nowStamp(),
      type: "comment"
    });
    SafeVoiceDb.saveReports(allReports);
    SafeVoiceDb.addAuditLog({
      actorRole: activeRole === "Public User" ? "System" : activeRole,
      actorRef: activeUser?.id || "system",
      actionType: "ACCESS_REVIEW",
      subjectId: caseId,
      outcome: "Recorded",
      metadataNotice: "Audit records note creation, not the note body."
    });
    reloadFromDb();
  };

  const handleAddAdminReplyMessage = (caseId: string, text: string) => {
    const replyTime = nowStamp();
    const authorRole = activeRole === "Public User" ? "Compliance Officer" : activeRole;

    SafeVoiceDb.saveMessages([
      {
        id: `msg-admin-${Date.now()}`,
        caseId,
        sender: authorRole as CaseMessage["sender"],
        text,
        timestamp: replyTime,
        readByReporter: false,
        readByAdmin: true
      },
      ...SafeVoiceDb.getMessages()
    ]);

    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (target) {
      target.status = target.status === "Received" ? "Acknowledged" : target.status;
      target.timeline.unshift({
        id: `tl-reply-${Date.now()}`,
        title: "Staff reply posted",
        description: "A follow-up message was posted through the anonymous communication channel.",
        timestamp: replyTime,
        type: "message"
      });
      SafeVoiceDb.saveReports(allReports);
    }

    SafeVoiceDb.addAuditLog({
      actorRole: authorRole as AppRole,
      actorRef: activeUser?.id || "role-simulator",
      actionType: "MESSAGE_POSTED",
      subjectId: caseId,
      outcome: "Allowed",
      metadataNotice: "Message audit excludes message body and reporter technical data."
    });
    reloadFromDb();
  };

  const handleInviteOfficerObj = (name: string, email: string, role: AppRole) => {
    SafeVoiceDb.saveUsers([
      ...SafeVoiceDb.getUsers(),
      {
        id: `usr-${Date.now()}`,
        name,
        email,
        role,
        status: "Pending",
        joinedDate: new Date().toISOString().split("T")[0],
        mfaRequired: true,
        lastLoginReview: "Pending activation"
      }
    ]);

    SafeVoiceDb.addAuditLog({
      actorRole: activeRole === "Public User" ? "System" : activeRole,
      actorRef: activeUser?.id || "system",
      actionType: "OFFICER_INVITED",
      outcome: "Allowed",
      metadataNotice: "Officer invite stores business contact only; MFA is mandatory before access."
    });
    reloadFromDb();
  };

  const handleRetentionUpdate = (caseId: string, legalHold: boolean, reason?: string) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (!target) return;

    const oldValue = target.retention.state;
    target.retention.state = legalHold ? "Legal Hold" : target.status === "Closed" ? "Deletion Scheduled" : "Active";
    target.retention.legalHoldReason = legalHold ? reason || "Legal review pending" : undefined;
    target.timeline.unshift({
      id: `tl-ret-${Date.now()}`,
      title: legalHold ? "Legal hold applied" : "Legal hold removed",
      description: legalHold
        ? "Automatic deletion paused for a documented legal reason."
        : "Retention schedule restored.",
      timestamp: nowStamp(),
      type: "retention"
    });
    SafeVoiceDb.saveReports(allReports);
    SafeVoiceDb.addAuditLog({
      actorRole: activeRole === "Public User" ? "System" : activeRole,
      actorRef: activeUser?.id || "system",
      actionType: "RETENTION_UPDATED",
      subjectId: caseId,
      outcome: "Allowed",
      oldValue,
      newValue: target.retention.state,
      metadataNotice: "Retention event contains no reporter identifiers."
    });
    reloadFromDb();
  };

  const handleMarkAllAlertsRead = () => {
    SafeVoiceDb.saveNotifications(SafeVoiceDb.getNotifications().map((notification) => ({ ...notification, read: true })));
    reloadFromDb();
  };

  const staffPermission = activeRole !== "Public User" ? activeRole : undefined;

  return (
    <div className="bg-slate-50 text-slate-900 font-sans min-h-screen flex antialiased">
      {/* Skip link lets keyboard and screen-reader users jump past the menus straight to content (WCAG 2.4.1). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:bg-cyan-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
      >
        {t("common.skipToContent")}
      </a>
      <AppSidebar
        currentPath={currentPath}
        onNavigate={navigateTo}
        activeRole={activeRole}
        setActiveRole={setRole}
        unreadCount={messages.length}
      />

      <div className="flex-grow flex flex-col min-h-screen overflow-x-hidden">
        <AppNavbar activeRole={activeRole} setActiveRole={setRole} notifications={notifications} onMarkAllRead={handleMarkAllAlertsRead} />

        {activeRole === "Public User" && currentPath === "/access-denied" && (
          <div className="bg-amber-50 border-b border-amber-250 px-6 py-2.5 text-xs text-amber-850 flex items-center gap-2" role="status">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            {t("accessDenied.staffBanner")}
          </div>
        )}

        <main id="main-content" className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20">
          <AnimatePresence mode="wait">
            {currentPath === "/report" && (
              <motion.div key="report" {...m({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } })}>
                <PublicReportPortal onSubmitReport={handleFormReportSubmit} />
              </motion.div>
            )}

            {currentPath === "/report/success" && (
              <motion.div key="success" {...m({ initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, y: -10 } })}>
                <ReportSuccessView generatedCode={lastSuccessCode} category={lastSuccessCategory} />
              </motion.div>
            )}

            {currentPath === "/track" && (
              <motion.div key="track" {...m({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } })}>
                <TrackCaseView
                  reports={reports}
                  messages={messages}
                  onAddMessage={handleReporterMessageSubmit}
                  onAddEvidence={handleReporterEvidenceSubmit}
                />
              </motion.div>
            )}

            {currentPath === "/access-denied" && (
              <motion.div key="denied" {...m({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } })}>
                <AccessDeniedView onGoReport={() => navigateTo("/report")} />
              </motion.div>
            )}

            {currentPath === "/dashboard" && staffPermission && (
              <motion.div key="dashboard" {...m({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } })}>
                <AdminDashboard reports={reports} activeRole={staffPermission} onNavigateToCases={() => navigateTo("/cases")} />
              </motion.div>
            )}

            {currentPath === "/cases" && staffPermission && (
              <motion.div key="cases" {...m({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } })}>
                <CaseManagementGrid reports={reports} activeRole={staffPermission} onSelectCase={handleSelectCase} />
              </motion.div>
            )}

            {currentPath === "/cases/:id" && currentDetailsCase && staffPermission && (
              <motion.div key={`case-detail-${selectedCaseId}`} {...m({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } })}>
                <CaseDetailsView
                  caseItem={currentDetailsCase}
                  messages={messages}
                  users={users}
                  activeRole={staffPermission}
                  onUpdateStatus={handleUpdateCaseStatus}
                  onUpdateSeverity={handleUpdateCaseSeverity}
                  onAssignInvestigator={handleAssignInvestigator}
                  onAddInternalNote={handleAddInternalNote}
                  onAddAdminMessage={handleAddAdminReplyMessage}
                  onRetentionUpdate={handleRetentionUpdate}
                />
              </motion.div>
            )}

            {currentPath === "/messages" && staffPermission && (
              <motion.div key="messages" {...m({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } })}>
                <CentralEncryptedInbox reports={reports} messages={messages} activeRole={staffPermission} onAddAdminMessage={handleAddAdminReplyMessage} />
              </motion.div>
            )}

            {currentPath === "/audits" && staffPermission && (
              <motion.div key="audits" {...m({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } })}>
                <SecurityAuditTrailLogs logs={auditLogs} activeRole={staffPermission} />
              </motion.div>
            )}

            {currentPath === "/users" && staffPermission && (
              <motion.div key="users" {...m({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } })}>
                <UsersPermissionsMatrix users={users} activeRole={staffPermission} onInviteUser={handleInviteOfficerObj} />
              </motion.div>
            )}

            {currentPath === "/settings" && staffPermission && (
              <motion.div key="settings" {...m({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } })}>
                <BrandedSettingsView />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
