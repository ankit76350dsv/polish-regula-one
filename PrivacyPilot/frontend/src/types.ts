/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'Admin' | 'Compliance Officer' | 'Auditor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'Active' | 'Pending';
  lastActive?: string;
}

export type LegalBasis =
  | 'Consent (Art. 6(1)(a))'
  | 'Contract (Art. 6(1)(b))'
  | 'Legal Obligation (Art. 6(1)(c))'
  | 'Vital Interests (Art. 6(1)(d))'
  | 'Public Task (Art. 6(1)(e))'
  | 'Legitimate Interests (Art. 6(1)(f))';

export interface ProcessingActivity {
  id: string;
  name: string;
  purpose: string;
  dataCategory: string[]; // e.g. ["Contact Details", "Biometrics"]
  legalBasis: LegalBasis;
  retentionPeriod: string; // e.g. "3 Years"
  dpiaRequired: boolean;
  lastUpdated: string;
  status: 'Draft' | 'Active' | 'Archived' | 'Review Required';
  dataSubjects: string[]; // e.g. ["Customers", "Employees"]
  processors: string[]; // e.g. ["Google Cloud", "Stripe"]
  securityMeasures: string[]; // e.g. ["Encryption at rest", "MFA"]
  internationalTransfers: string; // e.g. "None", "EU-US DPF"
  riskScore: 'Low' | 'Medium' | 'High';
  riskJustification?: string;
  department: string;
}

export interface AuditLog {
  id: string;
  user: string;
  email: string;
  action: string;
  timestamp: string;
  oldValue: string;
  newValue: string;
  ipAddress: string;
  severity: 'Info' | 'Warning' | 'Critical';
}

export interface DocumentItem {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX';
  folder: string; // "ROPA", "Privacy Policies", "DPIA Reports", "Audit Evidence"
  size: string;
  createdOn: string;
  version: string;
  tags: string[];
  owner: string;
}

export interface GDPRWizardState {
  name: string;
  purpose: string;
  department: string;
  dataCategory: string[];
  legalBasis: LegalBasis;
  dataSubjects: string[];
  processors: string[];
  retentionPeriod: string;
  securityMeasures: string[];
  internationalTransfers: string;
  riskScore: 'Low' | 'Medium' | 'High';
  status: 'Draft' | 'Active';
}

export interface VersionInfo {
  version: string;
  date: string;
  author: string;
  changes: string;
}
