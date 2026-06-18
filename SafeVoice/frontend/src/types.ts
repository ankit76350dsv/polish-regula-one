export enum ReportCategory {
  Corruption = "Corruption",
  Fraud = "Fraud",
  PublicProcurement = "Public Procurement",
  AML = "AML / Terrorist Financing",
  ProductSafety = "Product Safety",
  Environmental = "Environmental Protection",
  ConsumerProtection = "Consumer Protection",
  DataProtection = "Privacy / Personal Data",
  Cybersecurity = "Network & Information Security",
  HealthSafety = "Public Health / Safety",
  Discrimination = "Discrimination",
  Harassment = "Harassment",
  LabourDispute = "Individual HR Grievance",
  Other = "Other"
}

export type CaseStatus =
  | "Received"
  | "Acknowledged"
  | "Triage"
  | "Investigating"
  | "Awaiting Reporter"
  | "Remediation"
  | "Closed";

export type CaseSeverity = "Low" | "Medium" | "High" | "Critical";

export type AppRole =
  | "Super Admin"
  | "Compliance Officer"
  | "Investigator"
  | "HR Manager"
  | "Auditor";

export type IntakeChannel =
  | "Anonymous web portal"
  | "Confidential named portal"
  | "HR grievance handoff";

export type RetentionState =
  | "Active"
  | "Legal Hold"
  | "Deletion Scheduled"
  | "Destroyed";

export type EvidenceStatus =
  | "Metadata stripped"
  | "Malware scan pending"
  | "Quarantined"
  | "Rejected";

export type DisclosureMode = "Anonymous" | "Confidential Named" | "HR Handoff";

export interface EvidenceAttachment {
  id: string;
  displayName: string;
  extension: "PDF" | "PNG" | "JPG" | "XML" | "DOCX";
  sizeLabel: string;
  status: EvidenceStatus;
  metadataStripped: boolean;
  originalNameStored: false;
  uploadedAt: string;
  storageVaultRef: string;
}

export interface CaseMessage {
  id: string;
  caseId: string;
  sender: "Reporter" | "Compliance Officer" | "Investigator" | "HR Manager" | "System";
  text: string;
  timestamp: string;
  attachments?: EvidenceAttachment[];
  readByReporter?: boolean;
  readByAdmin?: boolean;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "system" | "status" | "comment" | "message" | "attachment" | "retention";
}

export interface TechnicalMetadataPolicy {
  reporterIpStored: false;
  userAgentStored: false;
  deviceFingerprintStored: false;
  geolocationStored: false;
  browserFingerprintStored: false;
}

export interface RetentionPolicy {
  state: RetentionState;
  retentionYears: number;
  deleteAfter: string;
  irrelevantPersonalDataDeletionDue: string;
  legalHoldReason?: string;
}

export interface CaseReport {
  id: string;
  trackingCode?: string;
  category: ReportCategory;
  description: string;
  incidentDate: string;
  department: string;
  attachments: EvidenceAttachment[];
  status: CaseStatus;
  severity: CaseSeverity;
  submissionDate: string;
  acknowledgementDue: string;
  feedbackDue: string;
  assignedInvestigator?: string;
  disclosureMode: DisclosureMode;
  contactVaultRef?: string;
  intakeChannel: IntakeChannel;
  lawfulBasis: string;
  controller: string;
  processor: string;
  slaHoursRemaining: number;
  technicalMetadataPolicy: TechnicalMetadataPolicy;
  retention: RetentionPolicy;
  riskFlags: string[];
  timeline: TimelineEvent[];
}

export interface ReportSubmission {
  category: ReportCategory;
  description: string;
  incidentDate: string;
  department: string;
  attachments: EvidenceAttachment[];
  disclosureMode: DisclosureMode;
  contactVaultRef?: string;
}

export interface AuditLog {
  id: string;
  actorRole: AppRole | "System" | "Public Portal";
  actorRef: string;
  actionType:
    | "REPORT_RECEIVED"
    | "CASE_STATUS_CHANGED"
    | "SEVERITY_CHANGED"
    | "INVESTIGATOR_ASSIGNED"
    | "MESSAGE_POSTED"
    | "EVIDENCE_ADDED"
    | "OFFICER_INVITED"
    | "RETENTION_UPDATED"
    | "LOGIN_SECURITY"
    | "ACCESS_REVIEW";
  subjectId?: string;
  timestamp: string;
  outcome: "Allowed" | "Denied" | "Recorded";
  oldValue?: string;
  newValue?: string;
  metadataNotice: string;
  hashChain: string;
}

export interface SaaSUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: "Active" | "Pending" | "Locked";
  joinedDate: string;
  mfaRequired: boolean;
  lastLoginReview: string;
}

export interface RolePermissions {
  role: AppRole;
  viewReports: boolean;
  assignCases: boolean;
  closeCases: boolean;
  exportData: boolean;
  accessAudits: boolean;
  manageUsers: boolean;
  manageRetention: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  type: "new_report" | "escalation" | "sla_warning" | "update" | "message" | "retention";
  caseId?: string;
}

export interface ReviewRecommendation {
  area: string;
  currentFeature: string;
  classification: "Keep" | "Modify" | "Remove" | "Add";
  justification: string;
  risk: string;
}
