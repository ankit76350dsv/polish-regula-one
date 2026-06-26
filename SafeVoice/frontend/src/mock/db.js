/**
 * CENTRALISED MOCK DATA for SafeVoice.
 *
 * SIMPLE EXPLANATION:
 * This is the single "fake database" the whole app reads while we finish the UI
 * before the backend exists. Everything that would normally come from the server
 * lives here. When the real API is ready we DELETE nothing in the components —
 * we only change the service layer (src/services/*) to call the network instead
 * of the mock API. Because every screen already reads through services + Redux,
 * swapping the data source is the only change needed.
 *
 * The shapes below match what the real RegulaOne backend returns (the unwrapped
 * `data` of its AppResponse envelope), so the contract stays stable.
 */

// Catalogue of report categories. Values are stable keys; the visible label is
// translated in i18n under "categories.*".
export const reportCategories = [
  "Corruption",
  "Fraud",
  "Public Procurement",
  "AML / Terrorist Financing",
  "Product Safety",
  "Environmental Protection",
  "Consumer Protection",
  "Privacy / Personal Data",
  "Network & Information Security",
  "Public Health / Safety",
  "Discrimination",
  "Harassment",
  "Individual HR Grievance",
  "Other",
];

// Categories that are individual labour disputes → handled by HR, NOT as
// anonymous whistleblower cases (no tracking PIN). Matches the EU Directive's
// material scope and the Polish Act.
export const HR_ONLY_CATEGORIES = ["Individual HR Grievance"];

export const statusValues = [
  "Received",
  "Acknowledged",
  "Triage",
  "Investigating",
  "Awaiting Reporter",
  "Remediation",
  "Closed",
];

export const severityValues = ["Low", "Medium", "High", "Critical"];

export const reports = [
  {
    id: "SV-2026-001",
    // Only the SHA-256 fingerprint of the reporter's access key is ever stored —
    // never the key itself. (Seed fixtures use placeholder fingerprints.)
    keyHash: "9f1a7c2e4b6d8f0a1c3e5b7d9f0a2c4e6b8d0f1a3c5e7b9d0f2a4c6e8b0d2f4a",
    category: "Corruption",
    description:
      "Procurement requirements appear tailored to one supplier. The report describes gifts, supplier contacts, and matching equipment requirements without naming the reporter.",
    incidentDate: "2026-05-10",
    department: "Procurement",
    status: "Investigating",
    severity: "Critical",
    submissionDate: "2026-05-12 11:24",
    acknowledgementDue: "2026-05-19 11:24",
    feedbackDue: "2026-08-19 11:24",
    assignedInvestigator: "Tomasz Wójcik",
    disclosureMode: "Anonymous",
    intakeChannel: "Anonymous web portal",
    lawfulBasis: "Legal obligation and protected follow-up under the Poland 2024 Act",
    controller: "DSV Corporation Pty Ltd - RegulaOne Poland",
    processor: "SafeVoice EEA Processing Cluster",
    riskFlags: ["Public procurement", "Anti-retaliation", "Evidence preservation"],
    attachments: [
      { id: "ev-001-a", displayName: "Evidence 1 (PDF)", sizeLabel: "1.8 MB" },
      { id: "ev-001-b", displayName: "Evidence 2 (PNG)", sizeLabel: "420 KB" },
    ],
    retention: {
      state: "Active",
      retentionYears: 3,
      deleteAfter: "2029-12-31",
      irrelevantPersonalDataDeletionDue: "2026-05-26",
    },
    timeline: [
      {
        id: "tl-001-1",
        title: "Anonymous report received",
        description: "Intake accepted without IP, user-agent, device, browser, or geolocation storage.",
        timestamp: "2026-05-12 11:24",
        type: "system",
      },
      {
        id: "tl-001-2",
        title: "Acknowledgement available in portal",
        description: "7-day acknowledgement obligation satisfied through the tracking channel.",
        timestamp: "2026-05-13 09:00",
        type: "status",
      },
      {
        id: "tl-001-3",
        title: "Evidence sanitised",
        description: "Original filenames were not persisted; files are referenced by vault IDs after malware and metadata checks.",
        timestamp: "2026-05-13 09:15",
        type: "attachment",
      },
      {
        id: "tl-001-4",
        title: "Investigation opened",
        description: "Case assigned to an authorised investigator with written confidentiality duties.",
        timestamp: "2026-05-17 10:30",
        type: "status",
      },
    ],
  },
  {
    id: "SV-2026-002",
    keyHash: "3b5d7f9a1c2e4b6d8f0a2c4e6b8d0f1a3c5e7f9b1d3a5c7e9f0b2d4a6c8e0f2b",
    category: "Privacy / Personal Data",
    description:
      "A consultant allegedly exported customer records containing national identifiers to an unmanaged cloud drive.",
    incidentDate: "2026-05-18",
    department: "IT Security",
    status: "Triage",
    severity: "High",
    submissionDate: "2026-05-19 16:42",
    acknowledgementDue: "2026-05-26 16:42",
    feedbackDue: "2026-08-26 16:42",
    assignedInvestigator: "Zofia Wiśniewska",
    disclosureMode: "Anonymous",
    intakeChannel: "Anonymous web portal",
    lawfulBasis: "Legal obligation, regulatory investigation, and protection of data subjects",
    controller: "DSV Corporation Pty Ltd - RegulaOne Poland",
    processor: "SafeVoice EEA Processing Cluster",
    riskFlags: ["GDPR", "Possible breach notification", "Access review"],
    attachments: [{ id: "ev-002-a", displayName: "Evidence 1 (XML)", sizeLabel: "22 KB" }],
    retention: {
      state: "Active",
      retentionYears: 3,
      deleteAfter: "2029-12-31",
      irrelevantPersonalDataDeletionDue: "2026-06-02",
    },
    timeline: [
      {
        id: "tl-002-1",
        title: "Report received",
        description: "Personal data minimisation checks started; non-relevant identifiers are due for deletion within 14 days.",
        timestamp: "2026-05-19 16:42",
        type: "system",
      },
      {
        id: "tl-002-2",
        title: "DPO triage requested",
        description: "Compliance officer opened breach-risk triage without exposing reporter metadata to admins.",
        timestamp: "2026-05-20 08:15",
        type: "status",
      },
    ],
  },
  {
    id: "SV-2026-003",
    // HR grievance: handled by HR, no anonymous access key issued.
    keyHash: null,
    category: "Individual HR Grievance",
    description:
      "Individual overtime and scheduling grievance routed to HR. It is not represented as an anonymous whistleblower case.",
    incidentDate: "2026-05-22",
    department: "Logistics",
    status: "Received",
    severity: "Medium",
    submissionDate: "2026-05-24 07:12",
    acknowledgementDue: "2026-05-31 07:12",
    feedbackDue: "2026-08-31 07:12",
    assignedInvestigator: "Katarzyna Mazur",
    disclosureMode: "HR Handoff",
    intakeChannel: "HR grievance handoff",
    lawfulBasis: "HR grievance handling under internal labour procedure",
    controller: "DSV Corporation Pty Ltd - RegulaOne Poland",
    processor: "Internal HR desk",
    riskFlags: ["Outside whistleblower scope", "HR confidentiality required"],
    attachments: [],
    retention: {
      state: "Active",
      retentionYears: 3,
      deleteAfter: "2029-12-31",
      irrelevantPersonalDataDeletionDue: "2026-06-07",
    },
    timeline: [
      {
        id: "tl-003-1",
        title: "HR grievance handoff recorded",
        description: "No anonymous tracking PIN was generated. The case is separated from the whistleblower channel.",
        timestamp: "2026-05-24 07:12",
        type: "system",
      },
    ],
  },
];

export const messages = [
  {
    id: "msg-1-1",
    caseId: "SV-2026-001",
    sender: "Compliance Officer",
    text: "We acknowledged your report. If you can provide the approximate meeting date or procurement stage, do so without adding details that could identify you.",
    timestamp: "2026-05-15 10:00",
    attachments: [],
  },
  {
    id: "msg-1-2",
    caseId: "SV-2026-001",
    sender: "Anonymous Whistleblower",
    text: "The final specification call took place in the second week of May. The uploaded evidence points to the unique optical component requirement.",
    timestamp: "2026-05-15 14:24",
    attachments: [{ id: "ev-001-a", displayName: "Evidence 1 (PDF)" }],
  },
  {
    id: "msg-2-1",
    caseId: "SV-2026-002",
    sender: "Compliance Officer",
    text: "The DPO has been asked to review breach notification risk. Please add only facts that are necessary for the assessment.",
    timestamp: "2026-05-20 09:35",
    attachments: [],
  },
];

export const users = [
  { id: "usr-1", name: "Jan Kowalski", email: "jan.kowalski@regulaone.pl", role: "Super Admin", status: "Active", mfaRequired: true, lastLoginReview: "2026-06-14 09:12" },
  { id: "usr-2", name: "Zofia Wiśniewska", email: "zofia.wisniewska@regulaone.pl", role: "Compliance Officer", status: "Active", mfaRequired: true, lastLoginReview: "2026-06-16 08:45" },
  { id: "usr-3", name: "Tomasz Wójcik", email: "tomasz.wojcik@regulaone.pl", role: "Investigator", status: "Active", mfaRequired: true, lastLoginReview: "2026-06-15 11:20" },
  { id: "usr-4", name: "Katarzyna Mazur", email: "katarzyna.mazur@regulaone.pl", role: "HR Manager", status: "Active", mfaRequired: true, lastLoginReview: "2026-06-12 10:02" },
  { id: "usr-5", name: "Andrzej Kamiński", email: "andrzej.kaminski@external-audit.eu", role: "Auditor", status: "Pending", mfaRequired: true, lastLoginReview: "Not activated" },
];

export const rolePermissions = [
  { role: "Super Admin", viewReports: true, assignCases: true, closeCases: true, exportData: true, accessAudits: true, manageUsers: true, manageRetention: true },
  { role: "Compliance Officer", viewReports: true, assignCases: true, closeCases: true, exportData: false, accessAudits: true, manageUsers: false, manageRetention: true },
  { role: "Investigator", viewReports: true, assignCases: false, closeCases: false, exportData: false, accessAudits: false, manageUsers: false, manageRetention: false },
  { role: "HR Manager", viewReports: true, assignCases: false, closeCases: false, exportData: false, accessAudits: false, manageUsers: false, manageRetention: false },
  { role: "Auditor", viewReports: true, assignCases: false, closeCases: false, exportData: true, accessAudits: true, manageUsers: false, manageRetention: false },
];

export const auditLogs = [
  {
    id: "aud-1",
    actorRole: "System",
    actorRef: "safevoice-policy-engine",
    actionType: "ACCESS_REVIEW",
    subjectId: "tenant-policy",
    timestamp: "2026-06-01 10:14:52",
    outcome: "Recorded",
    metadataNotice: "Reporter IP, user-agent, browser fingerprint, device fingerprint, and geolocation are not available to administrators.",
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
    newValue: "Tomasz Wójcik",
    metadataNotice: "Administrative session details are restricted to security operations, not case investigators.",
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
  { area: "Public report intake", feature: "Category, incident date, department, narrative, optional evidence", decision: "Modify", justification: "Keep only data needed to assess the report and keep anonymous defaults visible.", risk: "Overly specific details can re-identify reporters in small teams." },
  { area: "Reporter identity fields", feature: "Direct identity fields", decision: "Remove", justification: "The report channel should not require direct identifiers for anonymous reports.", risk: "Administrators could infer or disclose reporter identity." },
  { area: "File upload", feature: "Evidence upload with sanitised display names", decision: "Modify", justification: "Restrict visible metadata and show only vault-style evidence references.", risk: "Original filenames and document metadata can reveal identity." },
  { area: "Retention", feature: "Retention and legal hold controls", decision: "Add", justification: "Closed cases need visible retention state, deletion scheduling, and legal hold status.", risk: "Keeping reports longer than needed conflicts with storage limitation." },
];

// The mock signed-in staff user (used when USE_MOCK is on, so the staff area is
// reachable without a real RegulaOne SSO backend).
export const mockCurrentUser = {
  name: "Zofia Wiśniewska",
  email: "zofia.wisniewska@regulaone.pl",
  role: "Compliance Officer",
  permissions: ["viewReports", "assignCases", "closeCases", "accessAudits", "manageRetention"],
  tenantId: "T-REGULAONE-PL",
  tenantName: "RegulaOne Poland",
  enabled: true,
  moduleIds: ["SAFEVOICE"],
  planExpired: false,
  planExpiresAt: "2027-01-01",
};

// Tailwind class maps for status / severity chips (kept with the data they describe).
export const statusClasses = {
  Received: "bg-sky-50 text-sky-700 border-sky-200",
  Acknowledged: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Triage: "bg-amber-50 text-amber-800 border-amber-200",
  Investigating: "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Awaiting Reporter": "bg-violet-50 text-violet-700 border-violet-200",
  Remediation: "bg-teal-50 text-teal-700 border-teal-200",
  Closed: "bg-slate-100 text-slate-700 border-slate-300",
};

export const severityClasses = {
  Low: "bg-slate-100 text-slate-700 border-slate-300",
  Medium: "bg-sky-50 text-sky-700 border-sky-200",
  High: "bg-amber-50 text-amber-800 border-amber-200",
  Critical: "bg-rose-50 text-rose-700 border-rose-200",
};
