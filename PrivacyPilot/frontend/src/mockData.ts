/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProcessingActivity, AuditLog, DocumentItem, User } from './types';

export const INITIAL_USERS: User[] = [
  { id: 'usr-1', name: 'Sophia Kowalsky', email: 's.kowalsky@privacy-pilot.io', role: 'Admin', status: 'Active', lastActive: '2026-05-29 09:30' },
  { id: 'usr-2', name: 'Liam Sterling', email: 'l.sterling@privacy-pilot.io', role: 'Compliance Officer', status: 'Active', lastActive: '2026-05-29 08:45' },
  { id: 'usr-3', name: 'Małgorzata Nowak', email: 'm.nowak@regulatory-audits.pl', role: 'Auditor', status: 'Active', lastActive: '2026-05-28 15:10' },
  { id: 'usr-4', name: 'Dominic Zhao', email: 'd.zhao@privacy-pilot.io', role: 'Compliance Officer', status: 'Pending', lastActive: undefined }
];

export const INITIAL_ACTIVITIES: ProcessingActivity[] = [
  {
    id: 'ACT-001',
    name: 'Customer Checkout & Payment Processing',
    purpose: 'To securely process e-commerce transactions, fulfill orders, and verify billing information.',
    dataCategory: ['Contact Details', 'Financial Data', 'Purchase History', 'IP Address'],
    legalBasis: 'Contract (Art. 6(1)(b))',
    retentionPeriod: '5 Years',
    dpiaRequired: false,
    lastUpdated: '2026-05-28 14:22',
    status: 'Active',
    dataSubjects: ['Customers'],
    processors: ['Stripe Inc.', 'AWS Ireland'],
    securityMeasures: ['AES-256 Storage Encryption', 'TLS 1.3 in Transit', 'Strict Role-Based Access Control'],
    internationalTransfers: 'EU-US Data Privacy Framework',
    riskScore: 'Medium',
    riskJustification: 'Handles high-volume credit card info and customer billing coordinates.',
    department: 'Sales & Finance'
  },
  {
    id: 'ACT-002',
    name: 'Biometric Face-ID Warehouse Terminal Authentication',
    purpose: 'Automatic face recognition and matching for warehouse access logs and high-security zones entry verification.',
    dataCategory: ['Biometric Data', 'Employee ID', 'Geographic Location-Realtime', 'Contact Details'],
    legalBasis: 'Consent (Art. 6(1)(a))',
    retentionPeriod: '1 Year',
    dpiaRequired: true,
    lastUpdated: '2026-05-29 09:15',
    status: 'Active',
    dataSubjects: ['Employees', 'Contractors'],
    processors: ['FaceAuth Ltd.', 'On-Premises Core Server'],
    securityMeasures: ['Salted Biometric Hash', 'Isolated Local Storage Network', 'Daily Encryption-Keys Rotation'],
    internationalTransfers: 'None (Stored locally)',
    riskScore: 'High',
    riskJustification: 'Uses biometric identifiers for automated authentication, triggering a high-risk scenario under Art 35 (DPIA required).',
    department: 'Corporate Security'
  },
  {
    id: 'ACT-003',
    name: 'Marketing Newsletter & Campaign Monitoring',
    purpose: 'To optimize newsletter delivery, send curated marketing messages, and analyze open rates.',
    dataCategory: ['Contact Details', 'Interests Preference', 'Tracking Pixels'],
    legalBasis: 'Consent (Art. 6(1)(a))',
    retentionPeriod: '2 Years (or until consent revocation)',
    dpiaRequired: false,
    lastUpdated: '2026-05-25 11:00',
    status: 'Active',
    dataSubjects: ['Prospects', 'Customers'],
    processors: ['Mailchimp Inc.', 'Google Analytics'],
    securityMeasures: ['Pseudonymized Tracking IDs', 'Standard Access Controls'],
    internationalTransfers: 'Standard Contractual Clauses (SCCs)',
    riskScore: 'Low',
    riskJustification: 'Standard light tracking backed by opt-in consent structures with immediate unsubscribe capability.',
    department: 'Marketing'
  },
  {
    id: 'ACT-004',
    name: 'Employee Medical Benefits Administration & Health Screening',
    purpose: 'Administration of secondary private medical packages, health insurance subsidies, and mandatory occupational health evaluations.',
    dataCategory: ['Health Data', 'Social Security Numbers', 'Contact Details', 'Family Background'],
    legalBasis: 'Legal Obligation (Art. 6(1)(c))',
    retentionPeriod: '10 Years',
    dpiaRequired: true,
    lastUpdated: '2026-05-12 16:40',
    status: 'Active',
    dataSubjects: ['Employees'],
    processors: ['Medicover Care', 'Allianz Corporate'],
    securityMeasures: ['Double Encryption Layers', 'Auditable Database Logs', 'Separate Database Instances'],
    internationalTransfers: 'None (Restricted to EU)',
    riskScore: 'High',
    riskJustification: 'Involves high-risk human wellness record metrics categorized under GDPR Special categories (Art 9), calling for strict DPIA rules.',
    department: 'Human Resources'
  },
  {
    id: 'ACT-005',
    name: 'Candidate Resumes & Interview Evaluation Tracker',
    purpose: 'Tracking, analyzing, and storing potential candidate profiles during open job postings.',
    dataCategory: ['Contact Details', 'Employment History', 'Education Credentials', 'Interview Feedbacks'],
    legalBasis: 'Legitimate Interests (Art. 6(1)(f))',
    retentionPeriod: '6 Months (unless separate consent provided)',
    dpiaRequired: false,
    lastUpdated: '2026-05-27 10:20',
    status: 'Draft',
    dataSubjects: ['Job Applicants'],
    processors: ['Greenhouse Inc.', 'G Suite Enterprise'],
    securityMeasures: ['Auto-expiry filters', 'Access limited strictly to Hiring Managers'],
    internationalTransfers: 'EU-US Data Privacy Framework',
    riskScore: 'Low',
    riskJustification: 'Low exposure, strict auto-wipe after job post is complete.',
    department: 'Talent Acquisition'
  }
];

export const INITIAL_AUDITS: AuditLog[] = [
  {
    id: 'AUD-9402',
    user: 'Sophia Kowalsky',
    email: 's.kowalsky@privacy-pilot.io',
    action: 'Modified Activity ROPA [ACT-002]',
    timestamp: '2026-05-29 09:15',
    oldValue: 'Status: Draft',
    newValue: 'Status: Active, Added Salted Biometric Hash safety',
    ipAddress: '194.22.41.98',
    severity: 'Warning'
  },
  {
    id: 'AUD-9388',
    user: 'Liam Sterling',
    email: 'l.sterling@privacy-pilot.io',
    action: 'Generated Privacy Policy Document',
    timestamp: '2026-05-29 08:30',
    oldValue: 'Draft v1.4',
    newValue: 'Official Live Publication v2.0',
    ipAddress: '194.22.41.112',
    severity: 'Info'
  },
  {
    id: 'AUD-9204',
    user: 'Małgorzata Nowak',
    email: 'm.nowak@regulatory-audits.pl',
    action: 'Exported ROPA JSON Record Manifest',
    timestamp: '2026-05-28 15:45',
    oldValue: 'In-app Database Storage',
    newValue: 'Dispatched to ZIP export (ROPA-All-2026.zip)',
    ipAddress: '46.101.21.3',
    severity: 'Critical'
  },
  {
    id: 'AUD-8911',
    user: 'Sophia Kowalsky',
    email: 's.kowalsky@privacy-pilot.io',
    action: 'Modified Company Retention Policies',
    timestamp: '2026-05-26 10:05',
    oldValue: 'Finance records: 3 Years',
    newValue: 'Finance records: 5 Years (updated in accordance with Tax Directive)',
    ipAddress: '194.22.45.1',
    severity: 'Warning'
  },
  {
    id: 'AUD-8801',
    user: 'System Cron Service',
    email: 'system@privacy-pilot.io',
    action: 'Auto-scan flag DPIA triggers',
    timestamp: '2026-05-25 00:00',
    oldValue: 'Scanned 4 activities, 1 risk flagged',
    newValue: 'Scanned 5 activities, 2 risks flagged (Biometric sensor, Medical subsidy)',
    ipAddress: '127.0.0.1',
    severity: 'Info'
  }
];

export const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'DOC-101',
    name: 'Unified_Privacy_Policy_v2.0.pdf',
    type: 'PDF',
    folder: 'Privacy Policies',
    size: '1.4 MB',
    createdOn: '2026-05-29',
    version: '2.0',
    tags: ['Customer-facing', 'GDPR-Art-13', 'Public'],
    owner: 'Liam Sterling'
  },
  {
    id: 'DOC-102',
    name: 'ROPA_Activity_Registry_Full_Q1.docx',
    type: 'DOCX',
    folder: 'ROPA',
    size: '412 KB',
    createdOn: '2026-05-28',
    version: '1.8',
    tags: ['Article-30', 'Internal-Audit', 'Official'],
    owner: 'Sophia Kowalsky'
  },
  {
    id: 'DOC-103',
    name: 'DPIA_Risk_Assessment_Warehouse_Biometrics.pdf',
    type: 'PDF',
    folder: 'DPIA Reports',
    size: '2.8 MB',
    createdOn: '2026-05-29',
    version: '1.0',
    tags: ['High-Risk', 'DPIA', 'Biometrics', 'Signed'],
    owner: 'Sophia Kowalsky'
  },
  {
    id: 'DOC-104',
    name: 'SCC_Agreement_Stripe_Fulfillment_Subprocessor.pdf',
    type: 'PDF',
    folder: 'Audit Evidence',
    size: '3.1 MB',
    createdOn: '2026-05-20',
    version: '3.3',
    tags: ['Subprocessors', 'Art-46', 'US-Transfer'],
    owner: 'Liam Sterling'
  },
  {
    id: 'DOC-105',
    name: 'DPIA_Employee_Wellness_Medical_SpecialCategory.pdf',
    type: 'PDF',
    folder: 'DPIA Reports',
    size: '1.9 MB',
    createdOn: '2026-05-15',
    version: '1.2',
    tags: ['Special-Category', 'HR-Data', 'DPIA'],
    owner: 'Liam Sterling'
  }
];

export const MOCK_PERMISSIONS = {
  Admin: ['Read', 'Write', 'Export', 'Delete', 'Manage Users'],
  'Compliance Officer': ['Read', 'Write', 'Export'],
  Auditor: ['Read', 'Export']
};
