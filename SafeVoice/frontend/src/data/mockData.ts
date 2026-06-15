/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CaseReport, AuditLog, SaaSUser, CaseMessage, CaseNote, NotificationItem, CaseStatus } from "../types";
import { ReportCategory } from "../types";

export const initialUsers: SaaSUser[] = [
  {
    id: "usr-1",
    name: "Jan Kowalski",
    email: "jan.kowalski@regulaone.pl",
    role: "Super Admin",
    status: "Active",
    joinedDate: "2026-01-10"
  },
  {
    id: "usr-2",
    name: "Zofia Wiśniewska",
    email: "zofia.wisniewska@regulaone.pl",
    role: "Compliance Officer",
    status: "Active",
    joinedDate: "2026-02-15"
  },
  {
    id: "usr-3",
    name: "Tomasz Wójcik",
    email: "tomasz.wojcik@regulaone.pl",
    role: "Investigator",
    status: "Active",
    joinedDate: "2026-03-01"
  },
  {
    id: "usr-4",
    name: "Katarzyna Mazur",
    email: "katarzyna.mazur@regulaone.pl",
    role: "HR Manager",
    status: "Active",
    joinedDate: "2026-04-12"
  },
  {
    id: "usr-5",
    name: "Andrzej Kamiński",
    email: "andrew.kam@external-audit.com",
    role: "Auditor",
    status: "Pending",
    joinedDate: "2026-05-20"
  }
];

export const initialReports: CaseReport[] = [
  {
    id: "SV-2026-001",
    trackingPin: "SV-7832-9012",
    category: ReportCategory.Corruption,
    description: "Irregularities in the public procurement process for IT equipment in the Warsaw Branch. High-ranking procurement managers received expensive gifts from the bidding hardware supplier (valued over 15,000 PLN) in exchange for exclusive technical specs requirements that matched only their inventory.",
    incidentDate: "2026-05-10",
    department: "Procurement & Logistics",
    attachments: ["procurement_spec_v3.pdf", "supplier_invoice_match.png"],
    status: "Investigating",
    severity: "Critical",
    submissionDate: "2026-05-12 11:24",
    assignedInvestigator: "Tomasz Wójcik",
    isAnonymous: true,
    slaHoursRemaining: 1440, // 60 days of 90-day legislative SLA
    timeline: [
      {
        id: "tem-1-1",
        title: "Report Submitted Confidentially",
        description: "Authenticated via system endpoint with AES-256 DB encryption active. Category 'Corruption' mapped to compliance alert.",
        timestamp: "2026-05-12 11:24",
        type: "system"
      },
      {
        id: "tem-1-2",
        title: "7-Day Pre-acknowledgement Confirmed",
        description: "The Polish compliance deadline met within the specified statutory period.",
        timestamp: "2026-05-13 09:00",
        type: "system"
      },
      {
        id: "tem-1-3",
        title: "Assigned to Investigator",
        description: "Case allocated to senior compliance lawyer Tomasz Wójcik for formal pre-assessment.",
        timestamp: "2026-05-14 14:10",
        type: "system"
      },
      {
        id: "tem-1-4",
        title: "Investigation Opened",
        description: "Preliminary evidence suggests matching inventory codes and restrictive bidder constraints.",
        timestamp: "2026-05-17 10:30",
        type: "status"
      }
    ]
  },
  {
    id: "SV-2026-002",
    trackingPin: "SV-1102-4951",
    category: ReportCategory.DataBreach,
    description: "Exporting confidential customer databases containing complete Polish ID numbers (PESEL) and addresses to an unencrypted Google Drive account by an external consultant without the required access approval. Violates our firm's GDPR policy.",
    incidentDate: "2026-05-18",
    department: "IT Infrastructure Support",
    attachments: ["unauthorized_gdrive_sync.csv"],
    status: "Under Review",
    severity: "High",
    submissionDate: "2026-05-19 16:42",
    assignedInvestigator: "Zofia Wiśniewska",
    isAnonymous: true,
    slaHoursRemaining: 1848,
    timeline: [
      {
        id: "tem-2-1",
        title: "Report Submitted",
        description: "Secure data breach protocol initiated. Automated SLA monitoring began.",
        timestamp: "2026-05-19 16:42",
        type: "system"
      },
      {
        id: "tem-2-2",
        title: "Assigned to Zofia Wiśniewska",
        description: "Compliance team alert triggered.",
        timestamp: "2026-05-20 08:15",
        type: "system"
      }
    ]
  },
  {
    id: "SV-2026-003",
    // Labour dispute - no tracking PIN for this category according to the Polish statutory rules!
    category: ReportCategory.LabourDispute,
    description: "Forced overtime in the Katowice warehouse without safety breaks or overtime allowance. Direct supervisor threatens shifts removal if team raises concerns on hours registry transparency.",
    incidentDate: "2026-05-22",
    department: "Logistics - Warehouse Katowice",
    attachments: [],
    status: "Received",
    severity: "Medium",
    submissionDate: "2026-05-24 07:12",
    assignedInvestigator: "Katarzyna Mazur", // Assigned straight to HR!
    isAnonymous: false,
    reporterName: "Michał Nowak",
    reporterEmail: "m.nowak@regulaone.pl",
    slaHoursRemaining: 2160,
    timeline: [
      {
        id: "tem-3-1",
        title: "Labour Dispute Routed to HR",
        description: "This report bypassed anonymous encryption filters and was forwarded directly to Human Resources.",
        timestamp: "2026-05-24 07:12",
        type: "system"
      }
    ]
  },
  {
    id: "SV-2026-004",
    trackingPin: "SV-9943-4481",
    category: ReportCategory.Harassment,
    description: "Repeated psychological harassment, intimidation, and verbal abuse by the senior product unit lead during team standups. High team turnover and multiple employees taking mental health leaves (L4) directly because of this work culture.",
    incidentDate: "2026-04-20",
    department: "Product Engineering",
    attachments: ["standup_audio_clip_transcript.xlsx"],
    status: "Investigating",
    severity: "High",
    submissionDate: "2026-04-25 15:30",
    assignedInvestigator: "Katarzyna Mazur",
    isAnonymous: true,
    slaHoursRemaining: 864,
    timeline: [
      {
        id: "tem-4-1",
        title: "Anonymous Report Received",
        description: "Secure routing setup completed. Highly sensitive whistleblower files marked restricted.",
        timestamp: "2026-04-25 15:30",
        type: "system"
      },
      {
        id: "tem-4-2",
        title: "Internal Check Approved",
        description: "Gathering historic HR exit surveys corroborating unit complaints.",
        timestamp: "2026-04-28 10:00",
        type: "status"
      }
    ]
  },
  {
    id: "SV-2026-005",
    trackingPin: "SV-5531-1192",
    category: ReportCategory.Fraud,
    description: "Invoice manipulation and double-billing of marketing agency consulting fees for fictitious search engine campaigns during Q1 2026. Discrepancy estimated at roughly 80,000 PLN, routed through a shell agency owner tied to a procurement agent's spouse.",
    incidentDate: "2026-03-15",
    department: "Marketing - Finance Unit",
    attachments: ["invoice_variance_ledger_q1.xlsx"],
    status: "Closed",
    severity: "Critical",
    submissionDate: "2026-03-20 09:15",
    assignedInvestigator: "Zofia Wiśniewska",
    isAnonymous: true,
    slaHoursRemaining: 0,
    timeline: [
      {
        id: "tem-5-1",
        title: "Report Received",
        description: "Direct alert dispatched to Compliance Officer.",
        timestamp: "2026-03-20 09:15",
        type: "system"
      },
      {
        id: "tem-5-2",
        title: "Formal Audit Initiated",
        description: "External audit panel validated ledger variance.",
        timestamp: "2026-03-25 14:00",
        type: "status"
      },
      {
        id: "tem-5-3",
        title: "Contract Terminated & Legal Prosecution Drafted",
        description: "The marketing vendor contract terminated. Retained services refunded. Formal legal case prepared.",
        timestamp: "2026-04-18 11:00",
        type: "status"
      },
      {
        id: "tem-5-4",
        title: "Case Formally Closed",
        description: "Full compliance resolution filed and reported to Board of Directors.",
        timestamp: "2026-05-15 16:30",
        type: "status"
      }
    ]
  }
];

export const initialAuditLogs: AuditLog[] = [
  {
    id: "aud-1",
    user: "Jan Kowalski (Super Admin)",
    action: "Configured Whistleblower System parameters for compliance with Polish Ustawa o ochronie sygnalistów",
    timestamp: "2026-05-01 10:14:52",
    ipAddress: "194.181.112.44"
  },
  {
    id: "aud-2",
    user: "Zofia Wiśniewska (Compliance Officer)",
    action: "Assigned investigator Tomasz Wójcik to procurement integrity report SV-2026-001",
    timestamp: "2026-05-14 14:10:05",
    ipAddress: "83.144.92.12"
  },
  {
    id: "aud-3",
    user: "Tomasz Wójcik (Investigator)",
    action: "Marked procurement incident report SV-2026-001 as severity status: Critical",
    timestamp: "2026-05-14 15:42:19",
    ipAddress: "83.144.92.15"
  },
  {
    id: "aud-4",
    user: "Katarzyna Mazur (HR Manager)",
    action: "Opened case HR routing check for Warehouse forced hours SV-2026-003",
    timestamp: "2026-05-24 08:30:11",
    ipAddress: "46.205.191.2"
  },
  {
    id: "aud-5",
    user: "System Daemon",
    action: "Archived closed ledger case reports SV-2026-005 in compliant write-once storage locker",
    timestamp: "2026-05-15 16:35:00",
    ipAddress: "localhost"
  }
];

export const initialMessages: CaseMessage[] = [
  {
    id: "msg-1-1",
    caseId: "SV-2026-001",
    sender: "Compliance Officer",
    text: "Welcome specifically to our secure communication channel. Your identity is completely shielded via random ledger hash logic. Could you specify if you have copies of the IT procurement specifications for v3 that was shared in the final steering call?",
    timestamp: "2026-05-15 10:00",
    readByReporter: true,
    readByAdmin: true
  },
  {
    id: "msg-1-2",
    caseId: "SV-2026-001",
    sender: "Reporter",
    text: "Yes, I have uploaded the draft document called 'procurement_spec_v3.pdf'. If you check line 124, you will see a requirements constraint specifying a direct optical component that only is distributed by Supplier TechGlobal Poland.",
    timestamp: "2026-05-15 14:24",
    readByReporter: true,
    readByAdmin: true,
    attachments: ["procurement_spec_v3.pdf"]
  },
  {
    id: "msg-1-3",
    caseId: "SV-2026-001",
    sender: "Investigator",
    text: "Excellent documentation. This represents a crystal-clear breach of anti-competition standards. We are conducting internal interviews tomorrow and will keep this secure thread updated. Please check regularly with your PIN code.",
    timestamp: "2026-05-16 09:12",
    readByReporter: false,
    readByAdmin: true
  }
];

export const initialNotifications: NotificationItem[] = [
  {
    id: "notif-1",
    title: "New Confidential Incident Submitted",
    description: "Case SV-2026-002 (Data Breach - IT Infrastructure) submitted via public portal.",
    timestamp: "2026-05-19 16:42",
    read: false,
    type: "new_report",
    caseId: "SV-2026-002"
  },
  {
    id: "notif-2",
    title: "SLA Warning Level 1",
    description: "SLA alert triggered for harassment investigation SV-2026-004. Assessment responses pending.",
    timestamp: "2026-05-28 08:00",
    read: false,
    type: "sla_warning",
    caseId: "SV-2026-004"
  },
  {
    id: "notif-3",
    title: "New Signal Message Received",
    description: "Whistleblower posted reply file on Case SV-2026-001 procurement inquiry.",
    timestamp: "2026-05-15 14:24",
    read: true,
    type: "message",
    caseId: "SV-2026-001"
  }
];

// Reusable local storage wrapper so users keep reports and actions they make during the session!
export class SafeVoiceDb {
  static getReports(): CaseReport[] {
    const data = localStorage.getItem("sv_reports");
    if (!data) {
      localStorage.setItem("sv_reports", JSON.stringify(initialReports));
      return initialReports;
    }
    return JSON.parse(data);
  }

  static saveReports(reports: CaseReport[]) {
    localStorage.setItem("sv_reports", JSON.stringify(reports));
  }

  static getAuditLogs(): AuditLog[] {
    const data = localStorage.getItem("sv_audit_logs");
    if (!data) {
      localStorage.setItem("sv_audit_logs", JSON.stringify(initialAuditLogs));
      return initialAuditLogs;
    }
    return JSON.parse(data);
  }

  static saveAuditLogs(logs: AuditLog[]) {
    localStorage.setItem("sv_audit_logs", JSON.stringify(logs));
  }

  static getMessages(): CaseMessage[] {
    const data = localStorage.getItem("sv_messages");
    if (!data) {
      localStorage.setItem("sv_messages", JSON.stringify(initialMessages));
      return initialMessages;
    }
    return JSON.parse(data);
  }

  static saveMessages(messages: CaseMessage[]) {
    localStorage.setItem("sv_messages", JSON.stringify(messages));
  }

  static getUsers(): SaaSUser[] {
    const data = localStorage.getItem("sv_users");
    if (!data) {
      localStorage.setItem("sv_users", JSON.stringify(initialUsers));
      return initialUsers;
    }
    return JSON.parse(data);
  }

  static saveUsers(users: SaaSUser[]) {
    localStorage.setItem("sv_users", JSON.stringify(users));
  }

  static getNotifications(): NotificationItem[] {
    const data = localStorage.getItem("sv_notifications");
    if (!data) {
      localStorage.setItem("sv_notifications", JSON.stringify(initialNotifications));
      return initialNotifications;
    }
    return JSON.parse(data);
  }

  static saveNotifications(notifications: NotificationItem[]) {
    localStorage.setItem("sv_notifications", JSON.stringify(notifications));
  }

  static addAuditLog(user: string, action: string, ipAddress: string = "83.144.92.12", oldStatus?: CaseStatus, newStatus?: CaseStatus) {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      user,
      action,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress,
      oldStatus,
      newStatus
    };
    logs.unshift(newLog);
    this.saveAuditLogs(logs);
    return newLog;
  }
}
