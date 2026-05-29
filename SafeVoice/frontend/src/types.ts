/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ReportCategory {
  Corruption = "Corruption",
  Fraud = "Fraud",
  Harassment = "Harassment",
  SafetyViolation = "Safety Violation",
  Discrimination = "Discrimination",
  DataBreach = "Data Breach",
  LabourDispute = "Labour Dispute",
  Other = "Other"
}

export type CaseStatus = "Received" | "Under Review" | "Investigating" | "Awaiting Information" | "Closed";

export type CaseSeverity = "Low" | "Medium" | "High" | "Critical";

export interface CaseMessage {
  id: string;
  caseId: string;
  sender: "Reporter" | "Compliance Officer" | "Investigator" | "HR Manager" | "System";
  text: string;
  timestamp: string;
  attachments?: string[];
  readByReporter?: boolean;
  readByAdmin?: boolean;
}

export interface CaseNote {
  id: string;
  caseId: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "system" | "status" | "comment" | "message" | "attachment";
}

export interface CaseReport {
  id: string;              // Case ID (e.g., SV-2026-004)
  trackingPin?: string;    // Confidential tracker (undefined for Labour Disputes)
  category: ReportCategory;
  description: string;
  incidentDate: string;
  department: string;
  attachments: string[];
  status: CaseStatus;
  severity: CaseSeverity;
  submissionDate: string;
  assignedInvestigator?: string;
  isAnonymous: boolean;
  reporterName?: string;   // empty if anonymous
  reporterEmail?: string;  // empty if anonymous
  slaHoursRemaining: number;
  timeline: TimelineEvent[];
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  oldStatus?: CaseStatus;
  newStatus?: CaseStatus;
}

export type AppRole = "Super Admin" | "Compliance Officer" | "Investigator" | "HR Manager" | "Auditor";

export interface SaaSUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: "Active" | "Pending";
  joinedDate: string;
}

export interface RolePermissions {
  role: AppRole;
  viewReports: boolean;
  assignCases: boolean;
  closeCases: boolean;
  exportData: boolean;
  accessAudits: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  type: "new_report" | "escalation" | "sla_warning" | "update" | "message";
  caseId?: string;
}

export interface ActiveUser {
  name: string;
  email: string;
  role: AppRole;
}
