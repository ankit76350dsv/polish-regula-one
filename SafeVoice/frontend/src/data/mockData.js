import { ReportCategory } from "../types";
import { activeJurisdiction } from "../config/activeJurisdiction";

// The example cases below use the active country's controller, processor, and retention
// period so a deployment for, say, Germany does not show Poland-specific demo text.
const CONTROLLER = activeJurisdiction.controllerName;
const PROCESSOR = activeJurisdiction.processorName;
const RETENTION_YEARS = activeJurisdiction.retentionYears;

// Bumping the version string forces the seed data to refresh in the browser. Tie it to the
// jurisdiction so switching country shows that country's demo controller/processor.
const STORAGE_VERSION = `safevoice-compliance-v3-${activeJurisdiction.code}`;

export const reporterMetadataPolicy = {
  reporterIpStored: false,
  userAgentStored: false,
  deviceFingerprintStored: false,
  geolocationStored: false,
  browserFingerprintStored: false,
};

export const rolePermissions = [
  {
    role: "Super Admin",
    viewReports: true,
    assignCases: true,
    closeCases: true,
    exportData: true,
    accessAudits: true,
    manageUsers: true,
    manageRetention: true,
  },
  {
    role: "Compliance Officer",
    viewReports: true,
    assignCases: true,
    closeCases: true,
    exportData: false,
    accessAudits: true,
    manageUsers: false,
    manageRetention: true,
  },
  {
    role: "Investigator",
    viewReports: true,
    assignCases: false,
    closeCases: false,
    exportData: false,
    accessAudits: false,
    manageUsers: false,
    manageRetention: false,
  },
  {
    role: "HR Manager",
    viewReports: true,
    assignCases: false,
    closeCases: false,
    exportData: false,
    accessAudits: false,
    manageUsers: false,
    manageRetention: false,
  },
  {
    role: "Auditor",
    viewReports: true,
    assignCases: false,
    closeCases: false,
    exportData: true,
    accessAudits: true,
    manageUsers: false,
    manageRetention: false,
  },
];

const evidence = (
  id,
  displayName,
  extension,
  sizeLabel,
  status = "Metadata stripped",
) => ({
  id,
  displayName,
  extension,
  sizeLabel,
  status,
  metadataStripped: status === "Metadata stripped",
  originalNameStored: false,
  uploadedAt: "2026-06-01 10:00",
  storageVaultRef: `vault://safevoice/evidence/${id}`,
});

export const initialUsers = [
  {
    id: "usr-1",
    name: "Jan Kowalski",
    email: "jan.kowalski@regulaone.pl",
    role: "Super Admin",
    status: "Active",
    joinedDate: "2026-01-10",
    mfaRequired: true,
    lastLoginReview: "2026-06-14 09:12",
  },
  {
    id: "usr-2",
    name: "Zofia Wisniewska",
    email: "zofia.wisniewska@regulaone.pl",
    role: "Compliance Officer",
    status: "Active",
    joinedDate: "2026-02-15",
    mfaRequired: true,
    lastLoginReview: "2026-06-16 08:45",
  },
  {
    id: "usr-3",
    name: "Tomasz Wojcik",
    email: "tomasz.wojcik@regulaone.pl",
    role: "Investigator",
    status: "Active",
    joinedDate: "2026-03-01",
    mfaRequired: true,
    lastLoginReview: "2026-06-15 11:20",
  },
  {
    id: "usr-4",
    name: "Katarzyna Mazur",
    email: "katarzyna.mazur@regulaone.pl",
    role: "HR Manager",
    status: "Active",
    joinedDate: "2026-04-12",
    mfaRequired: true,
    lastLoginReview: "2026-06-12 10:02",
  },
  {
    id: "usr-5",
    name: "Andrzej Kaminski",
    email: "andrew.kam@external-audit.eu",
    role: "Auditor",
    status: "Pending",
    joinedDate: "2026-05-20",
    mfaRequired: true,
    lastLoginReview: "Not activated",
  },
];

export const initialReports = [
  {
    id: "SV-2026-001",
    trackingCode: "SV-W4R9-M2Q7",
    category: ReportCategory.Corruption,
    description:
      "Procurement requirements appear tailored to one supplier. The report describes gifts, supplier contacts, and matching equipment requirements without naming the reporter.",
    incidentDate: "2026-05-10",
    department: "Procurement",
    attachments: [
      evidence("ev-001-a", "Evidence 1 (PDF)", "PDF", "1.8 MB"),
      evidence("ev-001-b", "Evidence 2 (PNG)", "PNG", "420 KB"),
    ],
    status: "Investigating",
    severity: "Critical",
    submissionDate: "2026-05-12 11:24",
    acknowledgementDue: "2026-05-19 11:24",
    feedbackDue: "2026-08-19 11:24",
    assignedInvestigator: "Tomasz Wojcik",
    disclosureMode: "Anonymous",
    intakeChannel: "Anonymous web portal",
    lawfulBasis: `Legal obligation and legitimate follow-up under ${activeJurisdiction.legalBasisLabel}`,
    controller: CONTROLLER,
    processor: PROCESSOR,
    slaHoursRemaining: 1488,
    technicalMetadataPolicy: reporterMetadataPolicy,
    retention: {
      state: "Active",
      retentionYears: RETENTION_YEARS,
      deleteAfter: "2029-12-31",
      irrelevantPersonalDataDeletionDue: "2026-05-26",
    },
    riskFlags: [
      "Public procurement",
      "Anti-retaliation",
      "Evidence preservation",
    ],
    timeline: [
      {
        id: "tl-001-1",
        title: "Anonymous report received",
        description:
          "Intake accepted without IP, user-agent, device, browser, or geolocation storage.",
        timestamp: "2026-05-12 11:24",
        type: "system",
      },
      {
        id: "tl-001-2",
        title: "Acknowledgement available in portal",
        description:
          "7-day acknowledgement obligation satisfied through the tracking channel.",
        timestamp: "2026-05-13 09:00",
        type: "status",
      },
      {
        id: "tl-001-3",
        title: "Evidence sanitized",
        description:
          "Original filenames were not persisted; files are referenced by vault IDs after malware and metadata checks.",
        timestamp: "2026-05-13 09:15",
        type: "attachment",
      },
      {
        id: "tl-001-4",
        title: "Investigation opened",
        description:
          "Case assigned to an authorized investigator with written confidentiality duties.",
        timestamp: "2026-05-17 10:30",
        type: "status",
      },
    ],
  },
  {
    id: "SV-2026-002",
    trackingCode: "SV-P8C2-L7H5",
    category: ReportCategory.DataProtection,
    description:
      "A consultant allegedly exported customer records containing national identifiers to an unmanaged cloud drive.",
    incidentDate: "2026-05-18",
    department: "IT Security",
    attachments: [evidence("ev-002-a", "Evidence 1 (XML)", "XML", "22 KB")],
    status: "Triage",
    severity: "High",
    submissionDate: "2026-05-19 16:42",
    acknowledgementDue: "2026-05-26 16:42",
    feedbackDue: "2026-08-26 16:42",
    assignedInvestigator: "Zofia Wisniewska",
    disclosureMode: "Anonymous",
    intakeChannel: "Anonymous web portal",
    lawfulBasis:
      "Legal obligation, regulatory investigation, and protection of data subjects",
    controller: CONTROLLER,
    processor: PROCESSOR,
    slaHoursRemaining: 1656,
    technicalMetadataPolicy: reporterMetadataPolicy,
    retention: {
      state: "Active",
      retentionYears: RETENTION_YEARS,
      deleteAfter: "2029-12-31",
      irrelevantPersonalDataDeletionDue: "2026-06-02",
    },
    riskFlags: ["GDPR", "Possible breach notification", "Access review"],
    timeline: [
      {
        id: "tl-002-1",
        title: "Report received",
        description:
          "Personal data minimization checks started; non-relevant identifiers are due for deletion within 14 days.",
        timestamp: "2026-05-19 16:42",
        type: "system",
      },
      {
        id: "tl-002-2",
        title: "DPO triage requested",
        description:
          "Compliance officer opened breach-risk triage without exposing reporter metadata to admins.",
        timestamp: "2026-05-20 08:15",
        type: "status",
      },
    ],
  },
  {
    id: "SV-2026-003",
    category: ReportCategory.LabourDispute,
    description:
      "Individual overtime and scheduling grievance routed to HR. It is not represented as an anonymous whistleblower case in this mock.",
    incidentDate: "2026-05-22",
    department: "Logistics",
    attachments: [],
    status: "Received",
    severity: "Medium",
    submissionDate: "2026-05-24 07:12",
    acknowledgementDue: "2026-05-31 07:12",
    feedbackDue: "2026-08-31 07:12",
    assignedInvestigator: "Katarzyna Mazur",
    disclosureMode: "HR Handoff",
    intakeChannel: "HR grievance handoff",
    lawfulBasis:
      "HR grievance handling under internal labour procedure; no SafeVoice tracking code issued",
    controller: CONTROLLER,
    processor: "Internal HR desk",
    slaHoursRemaining: 2160,
    technicalMetadataPolicy: reporterMetadataPolicy,
    retention: {
      state: "Active",
      retentionYears: RETENTION_YEARS,
      deleteAfter: "2029-12-31",
      irrelevantPersonalDataDeletionDue: "2026-06-07",
    },
    riskFlags: ["Outside whistleblower scope", "HR confidentiality required"],
    timeline: [
      {
        id: "tl-003-1",
        title: "HR grievance handoff recorded",
        description:
          "No anonymous tracking PIN was generated. The UI clearly separates this from the whistleblower channel.",
        timestamp: "2026-05-24 07:12",
        type: "system",
      },
    ],
  },
];

export const initialMessages = [
  {
    id: "msg-1-1",
    caseId: "SV-2026-001",
    sender: "Compliance Officer",
    text: "We acknowledged your report. If you can provide the approximate meeting date or procurement stage, do so without adding details that could identify you.",
    timestamp: "2026-05-15 10:00",
    readByReporter: true,
    readByAdmin: true,
  },
  {
    id: "msg-1-2",
    caseId: "SV-2026-001",
    sender: "Reporter",
    text: "The final specification call took place in the second week of May. The uploaded evidence points to the unique optical component requirement.",
    timestamp: "2026-05-15 14:24",
    readByReporter: true,
    readByAdmin: true,
    attachments: [initialReports[0].attachments[0]],
  },
];

export const initialAuditLogs = [
  {
    id: "aud-1",
    actorRole: "System",
    actorRef: "safevoice-policy-engine",
    actionType: "ACCESS_REVIEW",
    subjectId: "tenant-policy",
    timestamp: "2026-06-01 10:14:52",
    outcome: "Recorded",
    metadataNotice:
      "Reporter IP, user-agent, browser fingerprint, device fingerprint, and geolocation are not available to administrators.",
    hashChain: "seal-001",
  },
  {
    id: "aud-2",
    actorRole: "Compliance Officer",
    actorRef: "usr-2",
    actionType: "INVESTIGATOR_ASSIGNED",
    subjectId: "SV-2026-001",
    timestamp: "2026-05-14 14:10:05",
    outcome: "Allowed",
    oldValue: "Unassigned",
    newValue: "Tomasz Wojcik",
    metadataNotice:
      "Administrative session details are restricted to security operations, not case investigators.",
    hashChain: "seal-002",
  },
  {
    id: "aud-3",
    actorRole: "System",
    actorRef: "retention-scheduler",
    actionType: "RETENTION_UPDATED",
    subjectId: "SV-2026-002",
    timestamp: "2026-05-20 08:17:00",
    outcome: "Recorded",
    metadataNotice: "14-day irrelevant personal data deletion timer started.",
    hashChain: "seal-003",
  },
];

export const complianceReview = [
  {
    area: "Public report intake",
    currentFeature:
      "Category, incident date, department, narrative, optional evidence",
    classification: "Modify",
    justification:
      "Keep only data needed to assess the report; add clear privacy notice, lawful basis, external reporting information, and anonymous defaults.",
    risk: "Overly specific department names or narrative text can re-identify reporters in small teams.",
  },
  {
    area: "Reporter identity fields",
    currentFeature:
      "Legal name and corporate email were requested when anonymity was disabled",
    classification: "Remove",
    justification:
      "A whistleblower channel should not require direct identifiers. Contact should be through a tracking code or vault-backed relay only when voluntarily chosen.",
    risk: "Administrators could infer or disclose reporter identity.",
  },
  {
    area: "Labour dispute handling",
    currentFeature: "Forced named HR routing and no tracking PIN",
    classification: "Modify",
    justification:
      "Separate ordinary HR grievances from whistleblower reports, do not promise anonymous whistleblower protections for out-of-scope grievances, and avoid collecting unnecessary identifiers.",
    risk: "Mislabeling HR grievances as whistleblower cases creates legal confusion and confidentiality risk.",
  },
  {
    area: "Tracking workflow",
    currentFeature: "PIN-based status and two-way communication",
    classification: "Keep",
    justification:
      "Anonymous tracking supports acknowledgement, follow-up questions, and feedback without direct identity collection.",
    risk: "Tracking code must be high entropy, rate-limited, and never described as a decryption key.",
  },
  {
    area: "File upload",
    currentFeature: "File names were retained and XLSX was allowed",
    classification: "Modify",
    justification:
      "Restrict uploads to PDF, PNG, JPG, XML, and DOCX; remove original filenames from admin views; model metadata stripping, malware scanning, signed URLs, and encrypted storage.",
    risk: "Original filenames, document metadata, and spreadsheet content can reveal identity.",
  },
  {
    area: "Audit logs",
    currentFeature: "Admin-facing table exposed IP addresses",
    classification: "Modify",
    justification:
      "Reporter IP and user-agent should not be collected for case handling. Admin security telemetry should be restricted to security operations and not shown to case handlers.",
    risk: "Technical metadata can defeat anonymity.",
  },
  {
    area: "Dashboards and analytics",
    currentFeature: "Trend charts and department heatmaps",
    classification: "Remove",
    justification:
      "Aggregate analytics are not necessary for handling reports in the mock and can re-identify reporters in low-volume teams.",
    risk: "Small-cell analytics can expose reporting patterns.",
  },
  {
    area: "RBAC",
    currentFeature:
      "Public users were auto-upgraded to admin roles in simulator mode",
    classification: "Modify",
    justification:
      "Role changes must be explicit and access denied by default. Least privilege must govern case, audit, retention, and user-management actions.",
    risk: "Privilege confusion and accidental unauthorized case access.",
  },
  {
    area: "Retention",
    currentFeature: "Static retention copy without workflow enforcement",
    classification: "Add",
    justification:
      "Add configurable retention, legal hold, 14-day irrelevant-data deletion timer, and closed-case deletion scheduling.",
    risk: "Keeping reports longer than necessary conflicts with storage limitation.",
  },
  {
    area: "Administrative security",
    currentFeature: "Role simulator without MFA/session controls",
    classification: "Add",
    justification:
      "Display MFA, account lockout, session expiration, session revocation, login monitoring, and password policy requirements.",
    risk: "Compromised back-office accounts can expose sensitive case material.",
  },
];

const readJson = (key, fallback) => {
  SafeVoiceDb.ensureSeeded();
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
};

const seal = () => `seal-${Date.now().toString(36)}`;

export class SafeVoiceDb {
  static ensureSeeded() {
    if (localStorage.getItem("sv_schema_version") === STORAGE_VERSION) return;

    localStorage.setItem("sv_schema_version", STORAGE_VERSION);
    localStorage.setItem("sv_reports", JSON.stringify(initialReports));
    localStorage.setItem("sv_audit_logs", JSON.stringify(initialAuditLogs));
    localStorage.setItem("sv_messages", JSON.stringify(initialMessages));
    localStorage.setItem("sv_users", JSON.stringify(initialUsers));
  }

  static getReports() {
    return readJson("sv_reports", initialReports);
  }

  static saveReports(reports) {
    localStorage.setItem("sv_reports", JSON.stringify(reports));
  }

  static getAuditLogs() {
    return readJson("sv_audit_logs", initialAuditLogs);
  }

  static saveAuditLogs(logs) {
    localStorage.setItem("sv_audit_logs", JSON.stringify(logs));
  }

  static getMessages() {
    return readJson("sv_messages", initialMessages);
  }

  static saveMessages(messages) {
    localStorage.setItem("sv_messages", JSON.stringify(messages));
  }

  static getUsers() {
    return readJson("sv_users", initialUsers);
  }

  static saveUsers(users) {
    localStorage.setItem("sv_users", JSON.stringify(users));
  }

  static addAuditLog(log) {
    const logs = this.getAuditLogs();
    const newLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      hashChain: seal(),
      ...log,
    };
    this.saveAuditLogs([newLog, ...logs]);
    return newLog;
  }

  static can(role, permission) {
    const match = rolePermissions.find((p) => p.role === role);
    return Boolean(match?.[permission]);
  }
}
