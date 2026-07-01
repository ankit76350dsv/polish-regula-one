/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole =
  | 'SUPER_ADMIN'
  | 'TENANT_ADMIN'
  | 'COMPLIANCE_OFFICER'
  | 'DPO'
  | 'MANAGER'
  | 'EMPLOYEE'
  | 'AUDITOR'
  | 'LEGAL'
  | 'EXTERNAL_VENDOR'
  | 'EXTERNAL_AUDITOR'
  | 'EXTERNAL_SUBJECT';

export interface Tenant {
  id: string;
  name: string;
  industry: string;
  employees: number;
  country: string;
  nip: string;
  address: string;
  language: 'en' | 'pl';
  activePlan: 'Starter' | 'Growth' | 'Enterprise';
  status: 'active' | 'suspended' | 'trial';
  dataResidencyRegion: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  status: 'active' | 'inactive';
  mfaEnabled: boolean;
  lastActive: string;
  avatar: string;
}

export interface Activity {
  id: string;
  name: string;
  department: string;
  ownerId: string;
  ownerName: string;
  role: 'controller' | 'processor' | 'joint_controller';
  status: 'draft' | 'in_review' | 'dpo_advice' | 'legal_review' | 'approved' | 'published' | 'expired' | 'action_required';
  reviewDate: string;
  purpose: string;
  description: string;
  systemUsed: string;
  lawfulBasis: string; // Article 6(1) text
  specialCategoryCondition?: string; // Article 9(2) text
  criminalCategory?: string; // Article 10 text
  dataSubjects: string[];
  dataCategories: string[];
  dataSources: string[];
  recipients: string[];
  vendors: string[]; // Linked processor names
  transfers: boolean;
  transferRisk?: 'low' | 'medium' | 'high' | 'critical';
  transferSafeguards?: string[];
  retentionPeriod: string;
  retentionBasis: string;
  securityMeasures: string[];
  dpiaRequired: 'required' | 'optional' | 'not_indicated';
  completenessScore: number;
  lastModifiedBy: string;
  lastModifiedAt: string;
}

export interface DPIA {
  id: string;
  activityId: string;
  activityName: string;
  status: 'draft' | 'in_review' | 'advice_pending' | 'approved' | 'prior_consultation';
  riskScore: number; // 1 to 25 matrix
  criteriaMatched: string[]; // 12 Polish criteria from Monitor Polski
  thresholdScore: number; // number of criteria matched
  processingDescription: string;
  necessityDetails: string; // Assessment of proportionality and necessity
  risksIdentified: {
    id: string;
    risk: string;
    likelihood: number; // 1-5
    severity: number; // 1-5
    score: number; // product
    mitigation: string;
    residualScore: number;
  }[];
  safeguards: string[];
  residualRisk: 'low' | 'medium' | 'high' | 'critical';
  dpoAdvice: string;
  priorConsultationPackUrl?: string;
  approvals: {
    role: string;
    approver: string;
    status: 'pending' | 'approved' | 'rejected';
    date?: string;
    comment?: string;
  }[];
  timeline: {
    id: string;
    actor: string;
    action: string;
    date: string;
    comment?: string;
  }[];
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  source: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'rare' | 'unlikely' | 'moderate' | 'likely' | 'almost_certain';
  riskScore: number;
  owner: string;
  status: 'open' | 'mitigated' | 'monitoring';
  residualRiskScore: number;
  safeguards: string;
}

export interface Vendor {
  id: string;
  name: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  dpaStatus: 'signed' | 'missing' | 'in_negotiation';
  country: string;
  hostingRegion: string;
  subprocessors: string[];
  tomEvidence: string[];
  transferStatus: 'eea_only' | 'safeguards_active' | 'no_safeguards_warning';
  lastReview: string;
  owner: string;
  questionnaireCompleted: boolean;
}

export interface Transfer {
  id: string;
  activityId: string;
  activityName: string;
  recipient: string;
  country: string;
  isEea: boolean;
  mechanism: string; // Adequacy, SCC, BCRs, Derogations, etc.
  adequacy: boolean;
  sccSigned: boolean;
  safeguards: string[];
  transferFrequency: 'continuous' | 'periodic' | 'one_time';
  risk: 'low' | 'medium' | 'high' | 'critical';
  owner: string;
  reviewDate: string;
}

export interface Incident {
  id: string;
  title: string;
  reporter: string;
  discoveredDate?: string;
  discoveredAt?: string;
  reportedAt?: string;
  affectedData: string[] | string;
  affectedSubjectsCount?: number;
  approximateSubjects?: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  timerDeadline?: string;
  status: 'intake' | 'triage' | 'risk_assessment' | 'notified' | 'remediation' | 'closed' | 'under_investigation';
  notificationRequired?: boolean;
  uodoNotified?: boolean;
  rationale?: string;
  dataSubjectCommRequired?: boolean;
  remediationTasks?: {
    id: string;
    title: string;
    status: 'pending' | 'done';
    owner: string;
  }[];
  timeline?: {
    id: string;
    actor: string;
    action: string;
    date: string;
    description: string;
  }[];
}

export interface DSARRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  requestType: 'access' | 'erasure' | 'rectification' | 'restriction' | 'portability' | 'objection' | 'consent_withdrawal' | 'complaint';
  requestDetails: string;
  status: 'identity_verified' | 'in_progress' | 'response_drafted' | 'completed' | 'closed';
  deadline: string; // Date string (1 month SLA)
  verificationChecked?: boolean;
  identityVerified?: boolean;
  authCode?: string;
  verificationMethod?: string;
  collectionTasks: {
    id: string;
    title: string;
    owner?: string;
    assignedDept?: string;
    status: 'pending' | 'completed' | 'done';
  }[];
  responseText: string;
  submittedDate?: string;
  receivedAt?: string;
}

export interface Audit {
  id: string;
  title: string;
  auditType: 'internal' | 'uodo_readiness' | 'customer_audit' | 'vendor_audit';
  status: 'draft' | 'in_progress' | 'completed';
  auditor: string;
  evidenceCount: number;
  evidenceList: string[];
  findings: {
    id: string;
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    status: 'open' | 'resolved';
  }[];
  remediationTasks: string[];
  dueDate: string;
  completedDate?: string;
}

export interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'overdue';
  category: string;
  module: 'ropa' | 'dpia' | 'documents' | 'vendors' | 'transfers' | 'incidents' | 'dsar' | 'audits';
  dueDate: string;
  assignee: string;
  activityId?: string;
  referenceId?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'info' | 'warning' | 'alert' | 'success';
}

export interface SupportTicket {
  id: string;
  tenantName: string;
  subject: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'pending' | 'resolved';
  createdAt: string;
  message: string;
}
