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

export const reports = [
  {
    id: "SV-2026-001",
    trackingCode: "SV-W4R9-M2Q7",
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
    assignedInvestigator: "Tomasz Wojcik",
    disclosureMode: "Anonymous",
    intakeChannel: "Anonymous web portal",
    lawfulBasis: "Legal obligation and protected follow-up under the Poland 2024 Act",
    controller: "DSV Corporation Pty Ltd - RegulaOne Poland",
    processor: "SafeVoice EEA Processing Cluster",
    slaHoursRemaining: 1488,
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
    assignedInvestigator: "Zofia Wisniewska",
    disclosureMode: "Anonymous",
    intakeChannel: "Anonymous web portal",
    lawfulBasis: "Legal obligation, regulatory investigation, and protection of data subjects",
    controller: "DSV Corporation Pty Ltd - RegulaOne Poland",
    processor: "SafeVoice EEA Processing Cluster",
    slaHoursRemaining: 1656,
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
    trackingCode: "Not issued",
    category: "Individual HR Grievance",
    description:
      "Individual overtime and scheduling grievance routed to HR. It is not represented as an anonymous whistleblower case in this mock.",
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
    slaHoursRemaining: 2160,
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
        description:
          "No anonymous tracking PIN was generated. The UI clearly separates this from the whistleblower channel.",
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
  },
  {
    id: "msg-1-2",
    caseId: "SV-2026-001",
    sender: "Anonymous Whistleblower",
    text: "The final specification call took place in the second week of May. The uploaded evidence points to the unique optical component requirement.",
    timestamp: "2026-05-15 14:24",
    attachments: [reports[0].attachments[0]],
  },
  {
    id: "msg-2-1",
    caseId: "SV-2026-002",
    sender: "Compliance Officer",
    text: "The DPO has been asked to review breach notification risk. Please add only facts that are necessary for the assessment.",
    timestamp: "2026-05-20 09:35",
  },
];

export const users = [
  {
    id: "usr-1",
    name: "Jan Kowalski",
    email: "jan.kowalski@regulaone.pl",
    role: "Super Admin",
    status: "Active",
    mfaRequired: true,
    lastLoginReview: "2026-06-14 09:12",
  },
  {
    id: "usr-2",
    name: "Zofia Wisniewska",
    email: "zofia.wisniewska@regulaone.pl",
    role: "Compliance Officer",
    status: "Active",
    mfaRequired: true,
    lastLoginReview: "2026-06-16 08:45",
  },
  {
    id: "usr-3",
    name: "Tomasz Wojcik",
    email: "tomasz.wojcik@regulaone.pl",
    role: "Investigator",
    status: "Active",
    mfaRequired: true,
    lastLoginReview: "2026-06-15 11:20",
  },
  {
    id: "usr-4",
    name: "Katarzyna Mazur",
    email: "katarzyna.mazur@regulaone.pl",
    role: "HR Manager",
    status: "Active",
    mfaRequired: true,
    lastLoginReview: "2026-06-12 10:02",
  },
  {
    id: "usr-5",
    name: "Andrzej Kaminski",
    email: "andrew.kam@external-audit.eu",
    role: "Auditor",
    status: "Pending",
    mfaRequired: true,
    lastLoginReview: "Not activated",
  },
];

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

export const auditLogs = [
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
    feature: "Category, incident date, department, narrative, optional evidence",
    decision: "Modify",
    justification:
      "Keep only data needed to assess the report and keep anonymous defaults visible.",
    risk: "Overly specific details can re-identify reporters in small teams.",
  },
  {
    area: "Reporter identity fields",
    feature: "Direct identity fields",
    decision: "Remove",
    justification:
      "The report channel should not require direct identifiers for anonymous reports.",
    risk: "Administrators could infer or disclose reporter identity.",
  },
  {
    area: "File upload",
    feature: "Evidence upload with sanitized display names",
    decision: "Modify",
    justification:
      "Restrict visible metadata and show only vault-style evidence references.",
    risk: "Original filenames and document metadata can reveal identity.",
  },
  {
    area: "Retention",
    feature: "Retention and legal hold controls",
    decision: "Add",
    justification:
      "Closed cases need visible retention state, deletion scheduling, and legal hold status.",
    risk: "Keeping reports longer than needed conflicts with storage limitation.",
  },
];

export const statusClasses = {
  Received: "bg-sky-50 text-sky-700 border-sky-200",
  Acknowledged: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Triage: "bg-amber-50 text-amber-700 border-amber-200",
  Investigating: "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Awaiting Reporter": "bg-violet-50 text-violet-700 border-violet-200",
  Remediation: "bg-teal-50 text-teal-700 border-teal-200",
  Closed: "bg-slate-100 text-slate-700 border-slate-200",
};

export const severityClasses = {
  Low: "bg-slate-100 text-slate-700 border-slate-200",
  Medium: "bg-sky-50 text-sky-700 border-sky-200",
  High: "bg-amber-50 text-amber-800 border-amber-200",
  Critical: "bg-rose-50 text-rose-700 border-rose-200",
};
