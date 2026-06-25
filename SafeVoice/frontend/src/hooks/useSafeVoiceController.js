import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReportCategory } from "../types";
import { reporterMetadataPolicy, SafeVoiceDb } from "../data/mockData";
import { useJurisdiction } from "../config/activeJurisdiction";
import {
  addDays,
  addMonths,
  createCaseId,
  mapCategoryToBackend,
  mapDisclosureModeToBackend,
  nowStamp,
  retentionDate,
  severityFor,
} from "../utils/caseHelpers";
import {
  PAGE_TITLE_KEYS,
  PUBLIC_ROUTES,
  STAFF_HOME_ROUTE,
  useBrowserRoute,
} from "../routes/browserRoutes";

const SAFEVOICE_PUBLIC_CASES_URL = "http://localhost:9003/api/v1/public/cases";
const DEMO_TENANT_ID = "6a34ca2d9d71d550dff0c3b6";

export function useSafeVoiceController() {
  const { t } = useTranslation();
  const jurisdiction = useJurisdiction();
  const { currentPath, selectedCaseId, navigateTo } = useBrowserRoute();

  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeRole, setActiveRole] = useState("Public User");
  const [lastSuccessCode, setLastSuccessCode] = useState("");
  const [lastSuccessPin, setLastSuccessPin] = useState("");
  const [lastSuccessCategory, setLastSuccessCategory] = useState(
    ReportCategory.Corruption,
  );

  const reloadFromDb = useCallback(() => {
    setReports(SafeVoiceDb.getReports());
    setAuditLogs(SafeVoiceDb.getAuditLogs());
    setMessages(SafeVoiceDb.getMessages());
    setUsers(SafeVoiceDb.getUsers());
  }, []);

  useEffect(() => {
    SafeVoiceDb.ensureSeeded();
    reloadFromDb();
  }, [reloadFromDb]);

  useEffect(() => {
    const titleKey = PAGE_TITLE_KEYS[currentPath];
    document.title = titleKey
      ? `${t(titleKey)} · ${t("app.name")}`
      : t("app.documentTitle");
  }, [currentPath, t]);

  const setRole = (role) => {
    setActiveRole(role);
    if (role === "Public User" && !PUBLIC_ROUTES.includes(currentPath)) {
      navigateTo("/report");
    }
    if (role !== "Public User" && currentPath === "/access-denied") {
      navigateTo(STAFF_HOME_ROUTE);
    }
  };

  const activeUser = useMemo(
    () =>
      activeRole === "Public User"
        ? undefined
        : users.find((user) => user.role === activeRole),
    [activeRole, users],
  );

  const currentDetailsCase = selectedCaseId
    ? reports.find((report) => report.id === selectedCaseId)
    : null;

  const handleSelectCase = (caseId) => {
    navigateTo(`/cases/${caseId}`);
  };

  const handleFormReportSubmit = async (data) => {
    const isHrHandoff = data.category === ReportCategory.LabourDispute;
    const mappedCategory = mapCategoryToBackend(data.category);
    const mappedDisclosureMode = mapDisclosureModeToBackend(
      data.disclosureMode,
    );
    const mappedIntakeChannel =
      data.disclosureMode === "HR Handoff"
        ? "HR_GRIEVANCE_HANDOFF"
        : data.disclosureMode === "Confidential Named"
          ? "CONFIDENTIAL_NAMED_PORTAL"
          : "ANONYMOUS_WEB_PORTAL";

    let parsedIncidentDate = null;
    try {
      if (data.incidentDate) {
        parsedIncidentDate = new Date(
          data.incidentDate + "T00:00:00Z",
        ).toISOString();
      }
    } catch {
      parsedIncidentDate = new Date().toISOString();
    }

    try {
      const response = await fetch(SAFEVOICE_PUBLIC_CASES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": DEMO_TENANT_ID,
        },
        body: JSON.stringify({
          category: mappedCategory,
          description: data.description,
          incidentDate: parsedIncidentDate,
          department: data.department,
          disclosureMode: mappedDisclosureMode,
          contactVaultRef: data.contactVaultRef || null,
          intakeChannel: mappedIntakeChannel,
        }),
      });

      if (!response.ok) {
        throw new Error(
          "Failed to submit whistleblower report: " + response.statusText,
        );
      }

      const resData = await response.json();
      const generatedId = resData.id || createCaseId();
      const generatedTrackingCode = resData.trackingCode;
      const plaintextPin = resData.pin;
      const submissionDate = resData.submissionDate
        ? resData.submissionDate.replace("T", " ").substring(0, 16)
        : nowStamp();

      const newReport = {
        id: generatedId,
        trackingCode: generatedTrackingCode || undefined,
        category: data.category,
        description: data.description,
        incidentDate: data.incidentDate,
        department: data.department,
        attachments: data.attachments,
        status: "Received",
        severity: severityFor(data.category),
        submissionDate,
        acknowledgementDue: resData.acknowledgementDue
          ? resData.acknowledgementDue.replace("T", " ").substring(0, 16)
          : addDays(jurisdiction.acknowledgementDays),
        feedbackDue: resData.feedbackDue
          ? resData.feedbackDue.replace("T", " ").substring(0, 16)
          : addMonths(jurisdiction.feedbackMonths),
        assignedInvestigator: isHrHandoff ? "Katarzyna Mazur" : undefined,
        disclosureMode: data.disclosureMode,
        contactVaultRef:
          data.disclosureMode === "Confidential Named"
            ? data.contactVaultRef
            : undefined,
        intakeChannel:
          data.disclosureMode === "HR Handoff"
            ? "HR grievance handoff"
            : "Anonymous web portal",
        lawfulBasis: isHrHandoff
          ? "Internal HR grievance procedure; no SafeVoice anonymous tracking code issued"
          : `Legal obligation and legitimate follow-up under ${jurisdiction.legalBasisLabel}`,
        controller: jurisdiction.controllerName,
        processor: isHrHandoff
          ? "Internal HR desk"
          : jurisdiction.processorName,
        slaHoursRemaining: 2160,
        technicalMetadataPolicy: reporterMetadataPolicy,
        retention: {
          state: "Active",
          retentionYears: jurisdiction.retentionYears,
          deleteAfter: retentionDate(jurisdiction.retentionYears),
          irrelevantPersonalDataDeletionDue: addDays(
            jurisdiction.irrelevantDataDeletionDays,
          ),
        },
        riskFlags: isHrHandoff
          ? ["Outside whistleblower scope", "HR confidentiality required"]
          : ["Anonymous channel", "Anti-retaliation", "Metadata minimisation"],
        timeline: [
          {
            id: `tl-${Date.now()}`,
            title: isHrHandoff
              ? "HR grievance handoff recorded"
              : "Anonymous report received",
            description: isHrHandoff
              ? "No tracking code was generated. The workflow separates HR grievances from the whistleblower channel."
              : "Report accepted without storing reporter IP, user-agent, device fingerprint, browser fingerprint, or geolocation.",
            timestamp: submissionDate,
            type: "system",
          },
          {
            id: `tl-del-${Date.now()}`,
            title: "Irrelevant data deletion timer started",
            description:
              "Any accidentally collected non-relevant personal data must be removed within 14 days of discovery.",
            timestamp: submissionDate,
            type: "retention",
          },
        ],
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
            attachments: [],
          },
          ...SafeVoiceDb.getMessages(),
        ]);
      }

      SafeVoiceDb.addAuditLog({
        actorRole: "Public Portal",
        actorRef: "anonymous-intake",
        actionType: "REPORT_RECEIVED",
        subjectId: generatedId,
        outcome: "Recorded",
        metadataNotice:
          "Reporter network and device metadata were not collected for case handling.",
      });

      reloadFromDb();
      setLastSuccessCode(generatedTrackingCode);
      setLastSuccessPin(plaintextPin);
      setLastSuccessCategory(data.category);
      navigateTo("/report/success");
    } catch (err) {
      console.error(err);
      alert(
        "Failed to submit the whistleblower report to the backend. Please verify that the SafeVoice backend is running.",
      );
    }
  };

  const handleReporterMessageSubmit = (caseId, text) => {
    const msgTime = nowStamp();
    SafeVoiceDb.saveMessages([
      {
        id: `msg-rep-${Date.now()}`,
        caseId,
        sender: "Reporter",
        text,
        timestamp: msgTime,
      },
      ...SafeVoiceDb.getMessages(),
    ]);

    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (target) {
      target.timeline.unshift({
        id: `tl-rep-${Date.now()}`,
        title: "Reporter follow-up received",
        description:
          "Additional information posted through the anonymous communication channel.",
        timestamp: msgTime,
        type: "message",
      });
      target.status =
        target.status === "Received" ? "Acknowledged" : target.status;
      SafeVoiceDb.saveReports(allReports);
    }

    SafeVoiceDb.addAuditLog({
      actorRole: "Public Portal",
      actorRef: "anonymous-tracking-channel",
      actionType: "MESSAGE_POSTED",
      subjectId: caseId,
      outcome: "Recorded",
      metadataNotice:
        "Reporter message accepted without network or device identifiers.",
    });
    reloadFromDb();
  };

  const handleReporterEvidenceSubmit = (caseId, attachments) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (!target) return;

    const existing = new Set(
      target.attachments.map((attachment) => attachment.id),
    );
    const additions = attachments.filter(
      (attachment) => !existing.has(attachment.id),
    );
    if (additions.length === 0) return;

    target.attachments = [...target.attachments, ...additions];
    target.timeline.unshift({
      id: `tl-ev-${Date.now()}`,
      title: "Supplemental evidence added",
      description: `${additions.length} evidence reference(s) added after file-type validation, malware scan, and metadata stripping.`,
      timestamp: nowStamp(),
      type: "attachment",
    });
    SafeVoiceDb.saveReports(allReports);
    SafeVoiceDb.addAuditLog({
      actorRole: "Public Portal",
      actorRef: "anonymous-tracking-channel",
      actionType: "EVIDENCE_ADDED",
      subjectId: caseId,
      outcome: "Recorded",
      metadataNotice: "Original filenames are not shown to administrators.",
    });
    reloadFromDb();
  };

  const handleUpdateCaseStatus = (caseId, status) => {
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
      type: "status",
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
      outcome: SafeVoiceDb.can(activeRole || "Auditor", "closeCases")
        ? "Allowed"
        : "Recorded",
      oldValue,
      newValue: status,
      metadataNotice:
        "Audit entry contains case state only, not reporter identity or technical metadata.",
    });
    reloadFromDb();
  };

  const handleUpdateCaseSeverity = (caseId, severity) => {
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
      type: "status",
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
      metadataNotice: "No reporter metadata is present in this audit event.",
    });
    reloadFromDb();
  };

  const handleAssignInvestigator = (caseId, investigatorName) => {
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
      type: "system",
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
      metadataNotice:
        "Assignment event excludes reporter identity and network metadata.",
    });
    reloadFromDb();
  };

  const handleAddInternalNote = (caseId, text) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (!target) return;

    target.timeline.unshift({
      id: `tl-note-${Date.now()}`,
      title: "Restricted investigation note",
      description: text,
      timestamp: nowStamp(),
      type: "comment",
    });
    SafeVoiceDb.saveReports(allReports);
    SafeVoiceDb.addAuditLog({
      actorRole: activeRole === "Public User" ? "System" : activeRole,
      actorRef: activeUser?.id || "system",
      actionType: "ACCESS_REVIEW",
      subjectId: caseId,
      outcome: "Recorded",
      metadataNotice: "Audit records note creation, not the note body.",
    });
    reloadFromDb();
  };

  const handleAddAdminReplyMessage = (caseId, text) => {
    const replyTime = nowStamp();
    const authorRole =
      activeRole === "Public User" ? "Compliance Officer" : activeRole;

    SafeVoiceDb.saveMessages([
      {
        id: `msg-admin-${Date.now()}`,
        caseId,
        sender: authorRole,
        text,
        timestamp: replyTime,
        readByReporter: false,
        readByAdmin: true,
      },
      ...SafeVoiceDb.getMessages(),
    ]);

    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (target) {
      target.status =
        target.status === "Received" ? "Acknowledged" : target.status;
      target.timeline.unshift({
        id: `tl-reply-${Date.now()}`,
        title: "Staff reply posted",
        description:
          "A follow-up message was posted through the anonymous communication channel.",
        timestamp: replyTime,
        type: "message",
      });
      SafeVoiceDb.saveReports(allReports);
    }

    SafeVoiceDb.addAuditLog({
      actorRole: authorRole,
      actorRef: activeUser?.id || "role-simulator",
      actionType: "MESSAGE_POSTED",
      subjectId: caseId,
      outcome: "Allowed",
      metadataNotice:
        "Message audit excludes message body and reporter technical data.",
    });
    reloadFromDb();
  };

  const handleInviteOfficerObj = (name, email, role) => {
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
        lastLoginReview: "Pending activation",
      },
    ]);

    SafeVoiceDb.addAuditLog({
      actorRole: activeRole === "Public User" ? "System" : activeRole,
      actorRef: activeUser?.id || "system",
      actionType: "OFFICER_INVITED",
      outcome: "Allowed",
      metadataNotice:
        "Officer invite stores business contact only; MFA is mandatory before access.",
    });
    reloadFromDb();
  };

  const handleRetentionUpdate = (caseId, legalHold, reason) => {
    const allReports = SafeVoiceDb.getReports();
    const target = allReports.find((report) => report.id === caseId);
    if (!target) return;

    const oldValue = target.retention.state;
    target.retention.state = legalHold
      ? "Legal Hold"
      : target.status === "Closed"
        ? "Deletion Scheduled"
        : "Active";
    target.retention.legalHoldReason = legalHold
      ? reason || "Legal review pending"
      : undefined;
    target.timeline.unshift({
      id: `tl-ret-${Date.now()}`,
      title: legalHold ? "Legal hold applied" : "Legal hold removed",
      description: legalHold
        ? "Automatic deletion paused for a documented legal reason."
        : "Retention schedule restored.",
      timestamp: nowStamp(),
      type: "retention",
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
      metadataNotice: "Retention event contains no reporter identifiers.",
    });
    reloadFromDb();
  };

  const staffPermission =
    activeRole !== "Public User" ? activeRole : undefined;

  return {
    activeRole,
    auditLogs,
    currentDetailsCase,
    currentPath,
    handleAddAdminReplyMessage,
    handleAddInternalNote,
    handleAssignInvestigator,
    handleFormReportSubmit,
    handleInviteOfficerObj,
    handleReporterEvidenceSubmit,
    handleReporterMessageSubmit,
    handleRetentionUpdate,
    handleSelectCase,
    handleUpdateCaseSeverity,
    handleUpdateCaseStatus,
    lastSuccessCategory,
    lastSuccessCode,
    lastSuccessPin,
    messages,
    navigateTo,
    reports,
    selectedCaseId,
    setRole,
    staffPermission,
    users,
  };
}
