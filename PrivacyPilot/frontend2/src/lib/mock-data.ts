/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tenant, User, Activity, DPIA, Risk, Vendor, Transfer, Incident, DSARRequest, Audit, Task, Notification, SupportTicket } from '../types';

export const MOCK_TENANTS: Tenant[] = [
  {
    id: 'tenant-1',
    name: 'ABC Logistics Poland Sp. z o.o.',
    industry: 'Logistics & Supply Chain',
    employees: 450,
    country: 'Poland',
    nip: 'PL5252839201',
    address: 'ul. Towarowa 22, 00-839 Warszawa, Poland',
    language: 'pl',
    activePlan: 'Enterprise',
    status: 'active',
    dataResidencyRegion: 'AWS EU Frankfurt (eu-central-1)'
  },
  {
    id: 'tenant-2',
    name: 'Vistula Retail Group',
    industry: 'Retail & E-commerce',
    employees: 1200,
    country: 'Poland',
    nip: 'PL6762510293',
    address: 'al. Pokoju 18, 31-564 Kraków, Poland',
    language: 'en',
    activePlan: 'Growth',
    status: 'active',
    dataResidencyRegion: 'Azure Europe West (Netherlands)'
  },
  {
    id: 'tenant-3',
    name: 'Baltic Health Clinic',
    industry: 'Healthcare & Medicine',
    employees: 85,
    country: 'Poland',
    nip: 'PL5832930219',
    address: 'ul. Grunwaldzka 102, 80-244 Gdańsk, Poland',
    language: 'pl',
    activePlan: 'Growth',
    status: 'active',
    dataResidencyRegion: 'AWS EU Ireland (eu-west-1)'
  },
  {
    id: 'tenant-4',
    name: 'Kraków SaaS Labs',
    industry: 'Technology & Software',
    employees: 45,
    country: 'Poland',
    nip: 'PL6763920211',
    address: 'ul. Floriańska 12, 31-021 Kraków, Poland',
    language: 'en',
    activePlan: 'Starter',
    status: 'trial',
    dataResidencyRegion: 'AWS EU Frankfurt (eu-central-1)'
  },
  {
    id: 'tenant-5',
    name: 'Mazovia Accounting Office',
    industry: 'Financial & Accounting Services',
    employees: 12,
    country: 'Poland',
    nip: 'PL5218392019',
    address: 'ul. Marszałkowska 80, 00-517 Warszawa, Poland',
    language: 'pl',
    activePlan: 'Starter',
    status: 'active',
    dataResidencyRegion: 'AWS EU Ireland (eu-west-1)'
  }
];

export const MOCK_USERS: User[] = [
  {
    id: 'user-super',
    name: 'Krzysztof Kowalski',
    email: 'krzysztof@privacypilot.pl',
    role: 'SUPER_ADMIN',
    department: 'Platform Operations',
    status: 'active',
    mfaEnabled: true,
    lastActive: 'Just now',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80'
  },
  {
    id: 'user-admin',
    name: 'Tomasz Wiśniewski',
    email: 'tomasz.wisniewski@abclogistics.pl',
    role: 'TENANT_ADMIN',
    department: 'Management',
    status: 'active',
    mfaEnabled: true,
    lastActive: '5 mins ago',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80'
  },
  {
    id: 'user-officer',
    name: 'Karolina Wójcik',
    email: 'karolina.wojcik@abclogistics.pl',
    role: 'COMPLIANCE_OFFICER',
    department: 'Legal & Risk',
    status: 'active',
    mfaEnabled: true,
    lastActive: 'Active now',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&fit=crop&q=80'
  },
  {
    id: 'user-dpo',
    name: 'Janusz Nowak (IOD)',
    email: 'dpo@abclogistics.pl',
    role: 'DPO',
    department: 'Data Protection Office',
    status: 'active',
    mfaEnabled: true,
    lastActive: '2 hours ago',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&fit=crop&q=80'
  },
  {
    id: 'user-manager',
    name: 'Marek Mazur',
    email: 'marek.mazur@abclogistics.pl',
    role: 'MANAGER',
    department: 'Human Resources',
    status: 'active',
    mfaEnabled: false,
    lastActive: 'Yesterday',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&fit=crop&q=80'
  },
  {
    id: 'user-emp',
    name: 'Agnieszka Kaczmarek',
    email: 'agnieszka.k@abclogistics.pl',
    role: 'EMPLOYEE',
    department: 'Logistics Operations',
    status: 'active',
    mfaEnabled: false,
    lastActive: '3 days ago',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&fit=crop&q=80'
  },
  {
    id: 'user-auditor',
    name: 'Edward Sterling',
    email: 'e.sterling@compliancedrills.com',
    role: 'AUDITOR',
    department: 'External Audit Group',
    status: 'active',
    mfaEnabled: true,
    lastActive: '1 week ago',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&fit=crop&q=80'
  },
  {
    id: 'user-legal',
    name: 'Marta Budzyńska',
    email: 'marta.budzynska@abclogistics.pl',
    role: 'LEGAL',
    department: 'General Counsel',
    status: 'active',
    mfaEnabled: true,
    lastActive: '3 hours ago',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&fit=crop&q=80'
  }
];

export const MOCK_ACTIVITIES: Activity[] = [
  {
    id: 'act-1',
    name: 'HR Payroll & Employee Compensation',
    department: 'Human Resources',
    ownerId: 'user-manager',
    ownerName: 'Marek Mazur',
    role: 'controller',
    status: 'approved',
    reviewDate: '2026-12-15',
    purpose: 'Processing salaries, tax computations, social security contributions (ZUS), and related legal reporting.',
    description: 'Collection and processing of core employee data, salary agreements, bank account details, and statutory reporting variables to calculate monthly transfers and file mandatory government declarations.',
    systemUsed: 'Teta HR & SAP ERP Payroll',
    lawfulBasis: 'Art. 6(1)(c) - Legal obligation (Polish Labor Code, Social Security Act)',
    dataSubjects: ['Employees', 'Contractors', 'Former Employees'],
    dataCategories: ['Identification Data', 'Contact Data', 'Financial & Banking Data', 'Employment & Salary Metrics', 'NIP/PESEL numbers', 'ZUS reports'],
    dataSources: ['Directly from data subjects (upon hiring)'],
    recipients: ['Tax Authority (Urząd Skarbowy)', 'Social Security Board (ZUS)', 'Sygma Bank (Transfer Operator)'],
    vendors: ['Mazovia Accounting Office', 'Sygma Bank'],
    transfers: false,
    retentionPeriod: '10 years',
    retentionBasis: 'Polish Accounting and Labor Code requirements (retained from end of calendar year of termination).',
    securityMeasures: ['AES-256 database encryption', 'Strict role-based access control', 'Encrypted TLS 1.3 channel to ZUS portal', 'Quarterly password resets'],
    dpiaRequired: 'not_indicated',
    completenessScore: 100,
    lastModifiedBy: 'Karolina Wójcik',
    lastModifiedAt: '2026-06-20T14:30:00Z'
  },
  {
    id: 'act-2',
    name: 'Employee Recruitment Portals',
    department: 'Human Resources',
    ownerId: 'user-manager',
    ownerName: 'Marek Mazur',
    role: 'controller',
    status: 'in_review',
    reviewDate: '2026-09-01',
    purpose: 'Sourcing, screening, interviewing, and contracting candidates for employment positions.',
    description: 'Processing candidate resumes, cover letters, online screening assessments, and contact forms submitted voluntarily through recruiting boards or direct email listings.',
    systemUsed: 'eRecruiter & Pracuj.pl integrations',
    lawfulBasis: 'Art. 6(1)(a) - Candidate Consent & Art. 6(1)(b) - Steps prior to entering a contract',
    dataSubjects: ['Candidates / Job Applicants'],
    dataCategories: ['Identification Data', 'Contact Data', 'Professional Experience', 'Qualifications & Degrees', 'Personal References'],
    dataSources: ['Directly from job applicants', 'External portals (Pracuj.pl, LinkedIn)'],
    recipients: ['Department Managers', 'Internal HR Recruiter Teams'],
    vendors: ['Pracuj.pl Group', 'eRecruiter EU'],
    transfers: true,
    transferRisk: 'low',
    transferSafeguards: ['Standard Contractual Clauses (SCC)', 'EU-US Data Privacy Framework'],
    retentionPeriod: '3 years or until consent withdrawal',
    retentionBasis: 'Company policy for candidate pool replenishment, guided by general Polish civil claims prescription limits.',
    securityMeasures: ['SSL/TLS transmission', 'Access restricted strictly to hiring managers', 'Automatic deletion of expired candidate pools', 'No local storage permitted'],
    dpiaRequired: 'optional',
    completenessScore: 88,
    lastModifiedBy: 'Marek Mazur',
    lastModifiedAt: '2026-06-25T09:15:00Z'
  },
  {
    id: 'act-3',
    name: 'CCTV Intelligent Office Monitoring',
    department: 'Operations & Security',
    ownerId: 'user-admin',
    ownerName: 'Tomasz Wiśniewski',
    role: 'controller',
    status: 'action_required',
    reviewDate: '2026-08-30',
    purpose: 'Securing administrative spaces, protecting expensive material assets, preventing trespass, and securing employee safety.',
    description: 'Continuous continuous video surveillance recording at entries, hallways, servers, and logistics bays with modern motion sensing alerts and high-definition video archives.',
    systemUsed: 'Hikvision IP-NVR & CCTV Local Servers',
    lawfulBasis: 'Art. 6(1)(f) - Legitimate Interest of securing operations, assets, and liability protection',
    dataSubjects: ['Employees', 'Contractors', 'Office Visitors', 'Clients'],
    dataCategories: ['CCTV Video Footage', 'Physical Appearance & Clothing', 'Timestamps of movement'],
    dataSources: ['Direct optical captures by camera lenses'],
    recipients: ['Security Crew', 'External Security Contractor Sp. z o.o.'],
    vendors: ['Warsaw Safe Guard Sp. z o.o.'],
    transfers: false,
    retentionPeriod: '30 days',
    retentionBasis: 'Polish Labor Code Article 22(2) restricting employee surveillance logs storage exceeding 3 months, unless critical evidence.',
    securityMeasures: ['Physical vault lock for CCTV recorder', 'Non-networked localized storage loop', 'Automatic 30-day overwrite system', 'Watermarked export tracking'],
    dpiaRequired: 'required',
    completenessScore: 92,
    lastModifiedBy: 'Karolina Wójcik',
    lastModifiedAt: '2026-06-28T16:45:00Z'
  },
  {
    id: 'act-4',
    name: 'Telemedicine Consultation Platform',
    department: 'Medical Services',
    ownerId: 'user-officer',
    ownerName: 'Karolina Wójcik',
    role: 'controller',
    status: 'approved',
    reviewDate: '2027-01-10',
    purpose: 'Delivering remote healthcare, clinical diagnostics, health advisory, and prescription issuing.',
    description: 'Processing video chats, clinical images, health records, genetic histories, and diagnostic notes to coordinate patient wellness workflows via integrated digital medical portals.',
    systemUsed: 'MedX Telehealth Portal & AWS Central Servers',
    lawfulBasis: 'Art. 6(1)(b) - Processing medical contract & Art. 9(2)(h) - Medical diagnosis & health administration',
    specialCategoryCondition: 'Art. 9(2)(h) - Provision of health or social care treatment under professional secrecy',
    dataSubjects: ['Patients', 'Healthcare Professionals'],
    dataCategories: ['Identification Data', 'Contact Data', 'Biometric Data', 'Health Records', 'Genetic Information', 'Symptom Records', 'Prescription Lists'],
    dataSources: ['Directly from patient input', 'Diagnostic devices', 'Attending physicians'],
    recipients: ['Medical Registry Staff', 'Attending Doctors', 'National Health Fund (NFZ)', 'e-Zdrowie Prescriptions API'],
    vendors: ['AWS EU Frankfurt', 'MedX Systems SA'],
    transfers: false,
    retentionPeriod: '20 years',
    retentionBasis: 'Polish Healthcare Information Act (Ustawa o prawach pacjenta i Rzeczniku Praw Pacjenta) requiring 20 years storage for core medical histories.',
    securityMeasures: ['End-to-end encrypted video call (AES)', 'Database field-level encryption for health logs', 'Dynamic SSO validation', 'Hardware MFA keys for medical staff', 'Independent ISO 27001 audited datacenter hosting'],
    dpiaRequired: 'required',
    completenessScore: 100,
    lastModifiedBy: 'Janusz Nowak (IOD)',
    lastModifiedAt: '2026-06-29T11:20:00Z'
  },
  {
    id: 'act-5',
    name: 'Customer CRM Sales Pipeline',
    department: 'Sales & Marketing',
    ownerId: 'user-officer',
    ownerName: 'Karolina Wójcik',
    role: 'controller',
    status: 'approved',
    reviewDate: '2026-11-20',
    purpose: 'Tracking client acquisition pipelines, scheduling product demos, executing commercial contracts, and maintaining relationship touchpoints.',
    description: 'Logging prospect contact emails, telephone logs, pipeline steps, meeting notes, and billing preferences inside structured SaaS dashboards.',
    systemUsed: 'Salesforce EU Cloud instance',
    lawfulBasis: 'Art. 6(1)(f) - Legitimate Interest (Business Development) & Art. 6(1)(b) - Contractual negotiation',
    dataSubjects: ['Prospective Customers', 'Active Clients', 'Partner Contacts'],
    dataCategories: ['Identification Data', 'Contact Data', 'Employer Name / Role', 'Communication Metadata', 'Interaction history'],
    dataSources: ['Direct sales inputs', 'Website signup forms'],
    recipients: ['Sales Reps', 'Billing Department', 'Customer Success Teams'],
    vendors: ['Salesforce Ireland Ltd.'],
    transfers: true,
    transferRisk: 'medium',
    transferSafeguards: ['Standard Contractual Clauses (SCC)', 'Vendor Security Annex'],
    retentionPeriod: 'Until contract completion + 3 years civil claims limitation, or 2 years since last active contact for prospects',
    retentionBasis: 'Polish Civil Code Article 118 prescribing general limitation intervals for commercial relationships.',
    securityMeasures: ['SSO authentication', 'Strict client segmentation rules', 'IP-restricted logging', 'Automated stale-lead purging'],
    dpiaRequired: 'not_indicated',
    completenessScore: 90,
    lastModifiedBy: 'Karolina Wójcik',
    lastModifiedAt: '2026-06-18T08:40:00Z'
  },
  {
    id: 'act-6',
    name: 'Whistleblowing Hotline & Ethics Portal',
    department: 'Legal & Compliance',
    ownerId: 'user-legal',
    ownerName: 'Marta Budzyńska',
    role: 'joint_controller',
    status: 'in_review',
    reviewDate: '2026-10-15',
    purpose: 'Investigating suspected regulatory misconduct, workplace safety violations, accounting anomalies, or statutory infringements.',
    description: 'Confidential reporting portal collecting incident alerts, factual descriptions, corroborating document attachments, and target personnel names.',
    systemUsed: 'Whispli Secure Reporting Cloud',
    lawfulBasis: 'Art. 6(1)(c) - Compliance with legal obligation & Art. 9(2)(g) - Substantial public interest (Whistleblower Protection Act)',
    specialCategoryCondition: 'Art. 9(2)(g) - Processing necessary for reasons of substantial public interest on the basis of EU/national law',
    dataSubjects: ['Whistleblowers / Reporters', 'Accused Persons', 'Witnesses / Third Parties'],
    dataCategories: ['Identification Data (if non-anonymous)', 'Allegation Narratives', 'Evidence PDFs/Images', 'Employment Details'],
    dataSources: ['Confidential whistleblowing forms', 'Corporate logs'],
    recipients: ['Internal Audit Committee', 'External Legal Advisor Sp. k.', 'Relevant supervisory organs (if mandatory)'],
    vendors: ['Whispli Australia/EU'],
    transfers: true,
    transferRisk: 'high',
    transferSafeguards: ['Standard Contractual Clauses (SCC)', 'Strict client-side zero-knowledge encryption keys'],
    retentionPeriod: '5 years post-investigation closure',
    retentionBasis: 'Polish Whistleblower Protection Act (Ustawa o ochronie sygnalistów) retention directives.',
    securityMeasures: ['Zero-knowledge client-side encryption of reports', 'IP address masking', 'Access limited strictly to compliance counsel', 'Decentralized document containers'],
    dpiaRequired: 'required',
    completenessScore: 96,
    lastModifiedBy: 'Marta Budzyńska',
    lastModifiedAt: '2026-06-27T17:05:00Z'
  },
  {
    id: 'act-7',
    name: 'Supplier Invoicing & Accounting Processing',
    department: 'Finance',
    ownerId: 'user-officer',
    ownerName: 'Karolina Wójcik',
    role: 'processor',
    status: 'approved',
    reviewDate: '2027-02-15',
    purpose: 'Providing contracted accounting, invoice auditing, payroll support, and treasury records compilation to third-party merchant tenants.',
    description: 'Extracting buyer names, address listings, tax identifications, purchased item costs, and financial transfer logs to reconcile balance books.',
    systemUsed: 'Comarch ERP Optima Cloud',
    lawfulBasis: 'Art. 6(1)(b) - Execution of a contract & Art. 6(1)(c) - Legal accounting duties',
    dataSubjects: ['Supplier Contacts', 'Corporate Buyers', 'Solo Proprietors'],
    dataCategories: ['Tax IDs (NIP)', 'Bank Account Numbers (IBAN)', 'Physical Addresses', 'Invoiced sums & transactions'],
    dataSources: ['Client data uploads', 'Polish national KSeF (Krajowy System e-Faktur) receipts'],
    recipients: ['Mazovia Accounting Board', 'Skatteverket / Tax offices'],
    vendors: ['Comarch ERP Solutions'],
    transfers: false,
    retentionPeriod: '5 years from tax year termination',
    retentionBasis: 'Polish Corporate Income Tax Act and Accounting Act guidelines.',
    securityMeasures: ['Isolated tenant databases', 'Dual-factor database access controls', 'Regular ledger validity tests'],
    dpiaRequired: 'not_indicated',
    completenessScore: 100,
    lastModifiedBy: 'Karolina Wójcik',
    lastModifiedAt: '2026-06-15T12:00:00Z'
  }
];

export const MOCK_DPIAS: DPIA[] = [
  {
    id: 'dpia-1',
    activityId: 'act-3',
    activityName: 'CCTV Intelligent Office Monitoring',
    status: 'advice_pending',
    riskScore: 16,
    criteriaMatched: ['public_monitoring', 'vulnerable_subjects', 'innovative_tech'],
    thresholdScore: 3,
    processingDescription: 'The deployment of Hikvision continuous high-definition video monitors with added server-side motion alerts, analyzing continuous corridors and entryways which house vulnerable employee and candidate pools.',
    necessityDetails: 'The security of servers, logistics machinery, and safe locks cannot be achieved with less invasive means without leaving expensive materials unmonitored. Access is limited strictly to incidents, and video loops overwrite after 30 days automatically.',
    risksIdentified: [
      {
        id: 'r1',
        risk: 'Excessive employee monitoring / loss of workplace privacy',
        likelihood: 4,
        severity: 4,
        score: 16,
        mitigation: 'Implement physical camera shielding to prevent capturing desks, and publish warning signs explicitly in Polish & English.',
        residualScore: 8
      },
      {
        id: 'r2',
        risk: 'Unauthorised CCTV footage leak or hacking',
        likelihood: 3,
        severity: 4,
        score: 12,
        mitigation: 'Isolate the CCTV recorder network physically from standard office Wi-Fi, using encrypted copper cabling.',
        residualScore: 4
      }
    ],
    safeguards: [
      'Warning notices displayed clearly at all entryways',
      'No camera feeds directed towards employee workstations or resting rooms',
      'Encrypted localized hard drive arrays with physical safe locks',
      'Strict login audit logs stored for 12 months'
    ],
    residualRisk: 'medium',
    dpoAdvice: 'The installation is legally justifiable under Legitimate Interest, provided that the company executes immediate camera orientation updates to completely block standard office desks. Employees must receive a 2-week advance warning written in Polish.',
    approvals: [
      { role: 'DPO', approver: 'Janusz Nowak (IOD)', status: 'pending' },
      { role: 'Tenant Admin', approver: 'Tomasz Wiśniewski', status: 'pending' }
    ],
    timeline: [
      { id: 'dt1', actor: 'Karolina Wójcik', action: 'Created Screening & Threshold questionnaire', date: '2026-06-25' },
      { id: 'dt2', actor: 'Janusz Nowak (IOD)', action: 'Reviewed draft and requested physical layout maps', date: '2026-06-27' }
    ]
  },
  {
    id: 'dpia-2',
    activityId: 'act-4',
    activityName: 'Telemedicine Consultation Platform',
    status: 'approved',
    riskScore: 20,
    criteriaMatched: ['special_categories', 'vulnerable_subjects', 'innovative_tech', 'location_data'],
    thresholdScore: 4,
    processingDescription: 'Providing medical diagnostics, remote symptom tracking, and genetic assessments for patients on an AWS-hosted cloud medical ecosystem with real-time video Consultations.',
    necessityDetails: 'Medical care delivery requires immediate, accurate diagnostic telemetry which cannot be executed without special category data processing. Safeguards must operate at the database and communication layers.',
    risksIdentified: [
      {
        id: 'r3',
        risk: 'Medical data exposure during video transmission',
        likelihood: 3,
        severity: 5,
        score: 15,
        mitigation: 'Implement native WebRTC end-to-end encryption with dynamic security handshakes.',
        residualScore: 5
      },
      {
        id: 'r4',
        risk: 'System administrator accessing medical logs',
        likelihood: 3,
        severity: 5,
        score: 15,
        mitigation: 'Enforce database column encryption using AWS KMS keys. The database administrator has no decryption permissions.',
        residualScore: 3
      }
    ],
    safeguards: [
      'Database field-level AES encryption',
      'Mandatory hardware MFA keys for medical registries',
      'External quarterly white-box penetration testing',
      'Strict patient consent checkboxes for telemetry data logs'
    ],
    residualRisk: 'low',
    dpoAdvice: 'The DPIA establishes rigorous technical controls which lower the high initial risks to acceptable residual margins. Prior consultation under Article 36 is NOT required because residual risks are LOW.',
    approvals: [
      { role: 'DPO', approver: 'Janusz Nowak (IOD)', status: 'approved', date: '2026-06-28', comment: 'Technical barriers are highly satisfactory. Recommended approval.' },
      { role: 'Tenant Admin', approver: 'Tomasz Wiśniewski', status: 'approved', date: '2026-06-29', comment: 'Approved for deployment into production environments.' }
    ],
    timeline: [
      { id: 'dt3', actor: 'Karolina Wójcik', action: 'Initiated Threshold Analysis', date: '2026-06-10' },
      { id: 'dt4', actor: 'Janusz Nowak (IOD)', action: 'Delivered official Advice Note', date: '2026-06-28' },
      { id: 'dt5', actor: 'Tomasz Wiśniewski', action: 'Signed off DPIA risk profile', date: '2026-06-29' }
    ]
  },
  {
    id: 'dpia-3',
    activityId: 'act-6',
    activityName: 'Whistleblowing Hotline & Ethics Portal',
    status: 'draft',
    riskScore: 15,
    criteriaMatched: ['special_categories', 'vulnerable_subjects'],
    thresholdScore: 2,
    processingDescription: 'Operating a confidential complaint intake platform where employees, contractors, and third parties can file reports on suspected fraud, harassment, or administrative breaches.',
    necessityDetails: 'Required under Polish and EU Whistleblower Directives to create a safe, non-retaliatory corporate notification channel.',
    risksIdentified: [
      {
        id: 'r5',
        risk: 'Exposure of reporter identity triggering retaliation',
        likelihood: 3,
        severity: 5,
        score: 15,
        mitigation: 'Remove IP logging from Whispli servers and enforce cryptographic ticket codes instead of real names.',
        residualScore: 5
      }
    ],
    safeguards: [
      'No IP trackers logged in web headers',
      'All files metadata stripped upon upload',
      'Strict separation of compliance teams'
    ],
    residualRisk: 'medium',
    dpoAdvice: 'DPIA drafting initiated. Awaiting final response from external legal counsel regarding joint controller definitions.',
    approvals: [
      { role: 'DPO', approver: 'Janusz Nowak (IOD)', status: 'pending' },
      { role: 'Legal', approver: 'Marta Budzyńska', status: 'pending' }
    ],
    timeline: [
      { id: 'dt6', actor: 'Marta Budzyńska', action: 'Initiated draft dossier', date: '2026-06-26' }
    ]
  }
];

export const MOCK_RISKS: Risk[] = [
  {
    id: 'risk-1',
    title: 'Employee surveillance expansion without DPIA sign-off',
    description: 'The Operations team proposed adding biometric facial scans to warehouse check-ins without filing legal assessments or updating ROPA entries.',
    source: 'CCTV Intelligent Office Monitoring',
    impact: 'high',
    likelihood: 'likely',
    riskScore: 16,
    owner: 'Tomasz Wiśniewski',
    status: 'open',
    residualRiskScore: 12,
    safeguards: 'Strict platform blockage on new camera installations pending DPO review.'
  },
  {
    id: 'risk-2',
    title: 'Unlawful transfers to non-EU marketing subprocessors',
    description: 'Marketing team initiated email newsletter tests using a US software tool that lacks active EU Standard Contractual Clauses (SCCs).',
    source: 'Employee Recruitment Portals',
    impact: 'medium',
    likelihood: 'moderate',
    riskScore: 9,
    owner: 'Marek Mazur',
    status: 'mitigated',
    residualRiskScore: 3,
    safeguards: 'Terminated active integration and migrated accounts to MailerLite (EU hosting).'
  },
  {
    id: 'risk-3',
    title: 'Lack of verified identity prior to DSAR release',
    description: 'DSAR handlers might mistakenly dispatch data folders via standard emails without validating requester IDs.',
    source: 'Customer CRM Sales Pipeline',
    impact: 'critical',
    likelihood: 'unlikely',
    riskScore: 10,
    owner: 'Karolina Wójcik',
    status: 'monitoring',
    residualRiskScore: 2,
    safeguards: 'Implemented a multi-step digital ID verification checklist inside the PrivacyPilot request workflow.'
  }
];

export const MOCK_VENDORS: Vendor[] = [
  {
    id: 'v-1',
    name: 'AWS EU Frankfurt (Amazon Web Services)',
    risk: 'low',
    dpaStatus: 'signed',
    country: 'Germany / USA',
    hostingRegion: 'Frankfurt (eu-central-1)',
    subprocessors: ['Amazon Fiber Corp', 'Equinix Frankfurt'],
    tomEvidence: ['ISO 27001 Certificate', 'SOC 2 Type II Report', 'AWS DPA v4.1'],
    transferStatus: 'eea_only',
    lastReview: '2026-05-10',
    owner: 'Karolina Wójcik',
    questionnaireCompleted: true
  },
  {
    id: 'v-2',
    name: 'Pracuj.pl Group (Grupa Pracuj S.A.)',
    risk: 'medium',
    dpaStatus: 'signed',
    country: 'Poland',
    hostingRegion: 'Warsaw, Poland',
    subprocessors: ['Onet S.A.', 'Gdańsk Cloud S.A.'],
    tomEvidence: ['Pracuj Security Annex RODO-2025', 'Internal Audit Log Checklist'],
    transferStatus: 'eea_only',
    lastReview: '2026-04-18',
    owner: 'Marek Mazur',
    questionnaireCompleted: true
  },
  {
    id: 'v-3',
    name: 'eRecruiter EU Solutions',
    risk: 'low',
    dpaStatus: 'signed',
    country: 'Poland',
    hostingRegion: 'Warsaw, Poland',
    subprocessors: ['None'],
    tomEvidence: ['eRecruiter RODO Safety Protocol'],
    transferStatus: 'eea_only',
    lastReview: '2026-04-20',
    owner: 'Marek Mazur',
    questionnaireCompleted: true
  },
  {
    id: 'v-4',
    name: 'Salesforce Ireland Ltd.',
    risk: 'medium',
    dpaStatus: 'signed',
    country: 'Ireland / USA',
    hostingRegion: 'Frankfurt & Paris datacenters',
    subprocessors: ['Salesforce USA Inc', 'AWS Inc.'],
    tomEvidence: ['BCRs Approved under GDPR Art 47', 'SOC 3 Report', 'Salesforce DPA 2026'],
    transferStatus: 'safeguards_active',
    lastReview: '2026-06-01',
    owner: 'Karolina Wójcik',
    questionnaireCompleted: true
  },
  {
    id: 'v-5',
    name: 'Whispli Ltd. Australia',
    risk: 'high',
    dpaStatus: 'in_negotiation',
    country: 'Australia / Germany',
    hostingRegion: 'AWS Frankfurt zone (Reports only)',
    subprocessors: ['Whispli Australia Team', 'Stripe Payments AU'],
    tomEvidence: ['Whispli ISO 27001 Blueprint'],
    transferStatus: 'no_safeguards_warning',
    lastReview: '2026-06-25',
    owner: 'Marta Budzyńska',
    questionnaireCompleted: false
  }
];

export const MOCK_TRANSFERS: Transfer[] = [
  {
    id: 'tr-1',
    activityId: 'act-5',
    activityName: 'Customer CRM Sales Pipeline',
    recipient: 'Salesforce USA Inc. (via Salesforce Ireland)',
    country: 'United States',
    isEea: false,
    mechanism: 'Standard Contractual Clauses (SCCs) Art. 46',
    adequacy: false,
    sccSigned: true,
    safeguards: ['Column-level database encryption', 'EU-US Data Privacy Framework verified cert', 'Strict IP fencing on US engineer logins'],
    transferFrequency: 'continuous',
    risk: 'medium',
    owner: 'Karolina Wójcik',
    reviewDate: '2027-06-01'
  },
  {
    id: 'tr-2',
    activityId: 'act-6',
    activityName: 'Whistleblowing Hotline & Ethics Portal',
    recipient: 'Whispli Australia Pty Ltd',
    country: 'Australia',
    isEea: false,
    mechanism: 'SCCs in draft negotiation',
    adequacy: false,
    sccSigned: false,
    safeguards: ['Zero-knowledge browser keys', 'FIPS-140 network encryptors'],
    transferFrequency: 'periodic',
    risk: 'high',
    owner: 'Marta Budzyńska',
    reviewDate: '2026-09-15'
  },
  {
    id: 'tr-3',
    activityId: 'act-2',
    activityName: 'Employee Recruitment Portals',
    recipient: 'Pracuj.pl Group Servers',
    country: 'Poland',
    isEea: true,
    mechanism: 'Not applicable (Intra-EEA transfer)',
    adequacy: true,
    sccSigned: false,
    safeguards: ['None required (GDPR sovereign zone)'],
    transferFrequency: 'continuous',
    risk: 'low',
    owner: 'Marek Mazur',
    reviewDate: '2026-11-01'
  }
];

export const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'inc-2026-01',
    title: 'HR recruitment candidate log laptop theft',
    reporter: 'Marek Mazur',
    discoveredDate: '2026-06-29T10:00:00Z',
    affectedData: ['Candidate Resumes', 'Contact Emails', 'Interview assessment logs', 'PESEL numbers of 12 new hires'],
    affectedSubjectsCount: 145,
    risk: 'high',
    timerDeadline: new Date(new Date('2026-06-29T10:00:00Z').getTime() + 72 * 60 * 60 * 1000).toISOString(),
    status: 'risk_assessment',
    notificationRequired: true,
    rationale: 'Includes raw national identification numbers (PESEL) and contact files of job candidates. High potential risk of identity theft. Requires UODO notification and email alerts to all affected candidates.',
    dataSubjectCommRequired: true,
    timeline: [
      { id: 'it1', actor: 'Marek Mazur', action: 'Reported laptop theft to security helpline', date: '2026-06-29T10:15:00Z', description: 'Company laptop stolen from vehicle trunk. Drive was encrypted but access token might be compromised.' },
      { id: 'it2', actor: 'Karolina Wójcik', action: 'Initiated incident log & triggered 72h compliance clock', date: '2026-06-29T11:00:00Z', description: 'Triage initialized. Device credentials revoked via MDM dashboard.' },
      { id: 'it3', actor: 'Janusz Nowak (IOD)', action: 'Began drafting UODO notification dossier', date: '2026-06-30T09:30:00Z', description: 'Official notification form drafted in Polish. Waiting for IT forensics verification.' }
    ]
  },
  {
    id: 'inc-2026-02',
    title: 'Misconfigured public share on customer newsletter file',
    reporter: 'Anna Kaczmarek',
    discoveredDate: '2026-06-15T14:00:00Z',
    affectedData: ['Client contact emails', 'Client names'],
    affectedSubjectsCount: 320,
    risk: 'low',
    timerDeadline: new Date().toISOString(), // Already closed
    status: 'closed',
    notificationRequired: false,
    rationale: 'Access logs checked via server telemetry. Only 2 internal employees accessed the file while misconfigured. Exposure risk of rights and freedoms is unlikely. Documented in breach register but not sent to UODO.',
    dataSubjectCommRequired: false,
    timeline: [
      { id: 'it4', actor: 'Anna Kaczmarek', action: 'Detected misconfigured public link', date: '2026-06-15T14:10:00Z', description: 'Internal team sheet was shared as public link.' },
      { id: 'it5', actor: 'Karolina Wójcik', action: 'Fixed link privacy & downloaded server log audit', date: '2026-06-15T14:45:00Z', description: 'Link restricted to internal domains. Audit shows no third-party crawls.' },
      { id: 'it6', actor: 'Janusz Nowak (IOD)', action: 'Closed breach with rationale documentation', date: '2026-06-16T11:00:00Z', description: 'Formally closed. Non-reportable to authorities.' }
    ]
  }
];

export const MOCK_REQUESTS: DSARRequest[] = [
  {
    id: 'dsar-523',
    requesterName: 'Piotr Wiśniewski',
    requesterEmail: 'piotr.wisniewski@gmail.com',
    requestType: 'access',
    requestDetails: 'I wish to request an entire copy of all personal files, customer support conversations, and sales logs your logistics division has recorded containing my contact email.',
    status: 'in_progress',
    deadline: new Date(new Date().getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days left of 30-day SLA
    submittedDate: '2026-06-15',
    verificationChecked: true,
    verificationMethod: 'MFA Email verification code confirmed',
    collectionTasks: [
      { id: 'ct1', title: 'Extract sales logs from Salesforce CRM', owner: 'Karolina Wójcik', status: 'completed' },
      { id: 'ct2', title: 'Check logistics shipping archives', owner: 'Agnieszka Kaczmarek', status: 'pending' },
      { id: 'ct3', title: 'Audit Zendesk support files', owner: 'Karolina Wójcik', status: 'pending' }
    ],
    responseText: 'Szanowny Panie,\n\nW odpowiedzi na Pana wniosek z dnia 15 czerwca 2026 r. dotyczący dostępu do danych osobowych na podstawie Art. 15 RODO, przesyłamy zestawienie zebranych do tej pory danych w załączniku...'
  },
  {
    id: 'dsar-524',
    requesterName: 'Monika Kowalczyk',
    requesterEmail: 'monika_k21@wp.pl',
    requestType: 'erasure',
    requestDetails: 'Please completely delete my CV and applicant account from your hiring databases. I am no longer interested in corporate recruitment pools.',
    status: 'completed',
    deadline: new Date(new Date().getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    submittedDate: '2026-06-02',
    verificationChecked: true,
    verificationMethod: 'ID card partial scan verified by HR',
    collectionTasks: [
      { id: 'ct4', title: 'Remove record from eRecruiter and Pracuj DB', owner: 'Marek Mazur', status: 'completed' },
      { id: 'ct5', title: 'Purge local PDF resumes in HR drive', owner: 'Marek Mazur', status: 'completed' }
    ],
    responseText: 'Szanowna Pani,\n\nUprzejmie informujemy, iż wniosek o usunięcie danych (prawo do bycia zapomnianym - Art. 17 RODO) został zrealizowany. Pani dane z bazy eRecruiter oraz dysków lokalnych HR zostały trwale skasowane...'
  }
];

export const MOCK_AUDITS: Audit[] = [
  {
    id: 'aud-2026-01',
    title: 'Pre-UODO Readiness Assessment 2026',
    auditType: 'uodo_readiness',
    status: 'in_progress',
    auditor: 'Compliance Drills - Edward Sterling',
    evidenceCount: 12,
    evidenceList: ['ROPA Snapshot v2', 'TOMs Security Annex', 'Employee Training Register', 'DPA Whispli Draft', 'DPIA Medical consultation sign-off'],
    findings: [
      { id: 'f1', title: 'Unsigned Whispli Australia DPA contract', severity: 'high', description: 'Whistleblower system is active but the bilateral DPA with Australian vendor is still in legal negotiation.', status: 'open' },
      { id: 'f2', title: 'Stale resumes stored in shared HR network drive', severity: 'medium', description: '34 candidate resumes from 2022 are still stored in a generic folder without active retention reviews.', status: 'open' }
    ],
    remediationTasks: ['Execute Whispli DPA', 'Purge 2022 hiring drive'],
    dueDate: '2026-07-15'
  },
  {
    id: 'aud-2026-02',
    title: 'Internal IT Infrastructure Cybersecurity Drill',
    auditType: 'internal',
    status: 'completed',
    auditor: 'Internal Security Crew',
    evidenceCount: 6,
    evidenceList: ['Firewall rules audit', 'MFA activation log', 'Optima ERP penetration certificate'],
    findings: [
      { id: 'f3', title: 'MFA disabled for 4 HR employee accounts', severity: 'critical', description: 'Identified accounts with bypass permission in legacy AD system. Remedied immediately.', status: 'resolved' }
    ],
    remediationTasks: [],
    dueDate: '2026-05-30',
    completedDate: '2026-05-28'
  }
];

export const MOCK_TASKS: Task[] = [
  { id: 'task-101', title: 'Review outstanding legal phrasing for CRM privacy notice', status: 'todo', category: 'documents', module: 'documents', dueDate: '2026-07-05', assignee: 'Marta Budzyńska', referenceId: 'act-5' },
  { id: 'task-102', title: 'Approve advice note for Intelligent CCTV surveillance DPIA', status: 'in_progress', category: 'dpia', module: 'dpia', dueDate: '2026-07-02', assignee: 'Janusz Nowak (IOD)', referenceId: 'dpia-1' },
  { id: 'task-103', title: 'Execute Whispli Australia DPA security annex', status: 'blocked', category: 'vendors', module: 'vendors', dueDate: '2026-07-10', assignee: 'Tomasz Wiśniewski', referenceId: 'v-5' },
  { id: 'task-104', title: 'Verify Piotr Wiśniewski data logs in shipping files for DSAR', status: 'todo', category: 'dsar', module: 'dsar', dueDate: '2026-07-04', assignee: 'Agnieszka Kaczmarek', referenceId: 'dsar-523' },
  { id: 'task-105', title: 'Send UODO incident report for recruitment laptop theft', status: 'todo', category: 'incidents', module: 'incidents', dueDate: '2026-07-02', assignee: 'Karolina Wójcik', referenceId: 'inc-2026-01' },
  { id: 'task-106', title: 'Review CCTV storage hard overwrites log', status: 'done', category: 'ropa', module: 'ropa', dueDate: '2026-06-25', assignee: 'Tomasz Wiśniewski', referenceId: 'act-3' }
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'not-1', title: 'DPIA Review Requested', message: 'Marek Mazur requested DPO advice on Employee Recruits screening DPIA.', date: '10 mins ago', read: false, type: 'info' },
  { id: 'not-2', title: '72-Hour Breach Countdown Active', message: 'Urgent: Incident inc-2026-01 (HR Laptop theft) is reportable. 48 hours left.', date: '1 hour ago', read: false, type: 'alert' },
  { id: 'not-3', title: 'DSR Request Submitted', message: 'New data erasure wniosek submitted by Monika Kowalczyk.', date: 'Yesterday', read: true, type: 'warning' },
  { id: 'not-4', title: 'Document Published Successfully', message: 'Employee General RODO Notice v2.4 has been signed and locked.', date: '3 days ago', read: true, type: 'success' }
];

export const MOCK_TICKETS: SupportTicket[] = [
  { id: 'tick-201', tenantName: 'Baltic Health Clinic', subject: 'Custom health categories not displaying in default ROPA list', priority: 'high', status: 'open', createdAt: '2026-06-30T11:00:00Z', message: 'We require custom medical fields under Polish patient rights rules. Please check our template options.' },
  { id: 'tick-202', tenantName: 'Mazovia Accounting Office', subject: 'Downgrade subscription to Starter billing options', priority: 'medium', status: 'resolved', createdAt: '2026-06-28T09:15:00Z', message: 'Need to modify recurring invoice for smaller seat headcount.' },
  { id: 'tick-203', tenantName: 'Vistula Retail Group', subject: 'API synchronization timeout error with Microsoft 365 Azure Sync', priority: 'urgent', status: 'pending', createdAt: '2026-06-29T16:00:00Z', message: 'Our daily user sync is timing out on the Dublin tenant.' }
];

export const PLATFORM_AUDIT_LOGS = [
  { timestamp: '2026-06-30T23:10:12Z', actor: 'System Auto', action: 'Tenant ABC Logistics backup completed ( Frankfurt eu-central-1 )', target: 'Database Backup', status: 'success' },
  { timestamp: '2026-06-30T22:45:10Z', actor: 'Krzysztof Kowalski (Super)', action: 'Modified SaaS Trial duration for tenant Kraków SaaS Labs to 60 days', target: 'Tenant Config', status: 'success' },
  { timestamp: '2026-06-30T21:15:00Z', actor: 'Billing Engine', action: 'Processed monthly growth plan credit card for Vistula Retail Group', target: 'Invoices', status: 'success' },
  { timestamp: '2026-06-30T19:05:32Z', actor: 'Marek Mazur (ABC)', action: 'Uploaded DPA Evidence Document ( Pracuj_Security_Annex.pdf )', target: 'Vendor v-2', status: 'success' }
];
