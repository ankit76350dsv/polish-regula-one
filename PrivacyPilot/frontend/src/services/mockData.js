// Seed data for the mock backend. One realistic Polish tenant with activities,
// DPIAs, vendors, transfers, breaches and DSARs that exercise every legal path
// in the app (72h clock, DSAR extension, prior consultation, missing DPA…).
//
// Dates for deadlines are computed relative to "now" at seed time so clocks
// and SLA badges are alive on first run.

const now = Date.now();
const hours = (n) => n * 60 * 60 * 1000;
const days = (n) => n * 24 * hours(1);
const iso = (t) => new Date(t).toISOString();

export function buildSeed() {
  return {
    tenant: {
      id: 'tenant-abc',
      name: 'ABC Logistics Poland Sp. z o.o.',
    },

    settings: {
      company: {
        name: 'ABC Logistics Poland Sp. z o.o.',
        nip: '5252839201',
        regon: '146789123',
        krs: '0000921402',
        address: 'ul. Prosta 68, 00-838 Warszawa',
        website: 'https://abclogistics.example.pl',
      },
      dpo: {
        name: 'Janusz Nowak',
        email: 'iod@abclogistics.example.pl',
        phone: '+48 22 000 00 00',
        appointedAt: iso(now - days(200)),
        uodoNotifiedAt: iso(now - days(195)),   // notified within the 14-day window
        publishedOnWebsite: true,
      },
      // AI assistant preferences — per-tenant, off-switchable.
      ai: {
        enabled: true,
        excludeSpecialCategories: true, // never send Art. 9 / whistleblowing data to the AI
      },
    },

    users: [
      { id: 'u-admin',    name: 'Karolina Wójcik',    email: 'karolina.wojcik@abclogistics.example.pl', role: 'PRIVACYPILOT_ADMIN',       active: true },
      { id: 'u-co',       name: 'Marek Zieliński',    email: 'marek.zielinski@abclogistics.example.pl', role: 'PRIVACYPILOT_COMPLIANCE_OFFICER', active: true },
      { id: 'u-dpo',      name: 'Janusz Nowak',       email: 'iod@abclogistics.example.pl',             role: 'PRIVACYPILOT_DPO',                active: true },
      { id: 'u-auditor',  name: 'Ewa Kamińska',       email: 'ewa.kaminska@audytpartner.example.pl',    role: 'PRIVACYPILOT_AUDITOR',            active: true },
      { id: 'u-employee', name: 'Piotr Lewandowski',  email: 'piotr.lewandowski@abclogistics.example.pl', role: 'PRIVACYPILOT_EMPLOYEE',         active: true },
    ],

    // Processing activities (the ROPA / Art. 30 register) are NO LONGER mocked.
    // They come from the real PrivacyPilot backend (ProcessingActivityController),
    // through activityService.js + client.js. This array stays only so the modules
    // still on the mock (DPIA "start from activity", notice checklist) do not crash
    // when they look for db.activities; it is deliberately empty. Remove it once
    // those modules are wired to the real backend too.
    activities: [],

    dpias: [
      {
        id: 'dpia-001',
        activityId: 'act-003',
        title: 'DPIA — Monitoring wizyjny (CCTV)',
        status: 'in_progress',
        criteriaMatched: ['systematic_monitoring', 'vulnerable_subjects'],
        description: 'CCTV covering entrances, warehouse and parking. 24 cameras, continuous recording, 3-month retention, access limited to security staff.',
        necessity: 'Monitoring is limited to safety-relevant zones; social rooms and sanitary facilities are excluded (Art. 22(2) par. 2 Labour Code). Less intrusive measures (patrols) were assessed as insufficient at night.',
        risks: [
          { id: 'r1', description: 'Unauthorised access to footage', likelihood: 2, severity: 4, mitigation: 'Role-based access, access logging, encrypted storage', residualLikelihood: 1, residualSeverity: 3 },
          { id: 'r2', description: 'Retention beyond 3 months', likelihood: 2, severity: 3, mitigation: 'Automatic deletion job after 90 days', residualLikelihood: 1, residualSeverity: 2 },
        ],
        measures: ['Signage at all entrances', 'Automatic 90-day deletion', 'Access restricted to 3 security staff'],
        dpoAdvice: '',
        priorConsultation: false,
        approvals: [
          { role: 'PRIVACYPILOT_DPO', name: 'Janusz Nowak', approvedAt: null },
          { role: 'PRIVACYPILOT_ADMIN', name: 'Karolina Wójcik', approvedAt: null },
        ],
        createdAt: iso(now - days(30)),
        updatedAt: iso(now - days(7)),
      },
      {
        id: 'dpia-002',
        activityId: 'act-004',
        title: 'DPIA — System sygnalistów (whistleblowing)',
        status: 'approved',
        criteriaMatched: ['vulnerable_subjects', 'special_categories'],
        description: 'Internal reporting channel (SafeVoice). Reports may contain data of reporters, accused persons and witnesses, including criminal-offence data (Art. 10).',
        necessity: 'Channel is required by the Whistleblower Protection Act. Data minimisation: categories limited to report content; anonymous reporting supported; identity encrypted separately.',
        risks: [
          { id: 'r1', description: 'Identification of an anonymous reporter', likelihood: 2, severity: 5, mitigation: 'Identity data encrypted separately (AES-256-GCM); metadata stripped; access forbidden for admins', residualLikelihood: 1, residualSeverity: 5 },
          { id: 'r2', description: 'Retaliation risk from data leak', likelihood: 1, severity: 5, mitigation: 'Strict RBAC, audit logging, breach procedure', residualLikelihood: 1, residualSeverity: 4 },
        ],
        measures: ['Separate encryption of identity data', 'Access limited to whistleblower reviewers', 'No IP/metadata retention for anonymous channel'],
        dpoAdvice: 'Assessment adequate. Residual risk acceptable given encryption and access controls; prior consultation with UODO not required because mitigations reduce the high risk (Art. 36(1) applies only where residual risk remains high).',
        priorConsultation: false,
        approvals: [
          { role: 'PRIVACYPILOT_DPO', name: 'Janusz Nowak', approvedAt: iso(now - days(45)) },
          { role: 'PRIVACYPILOT_ADMIN', name: 'Karolina Wójcik', approvedAt: iso(now - days(44)) },
        ],
        createdAt: iso(now - days(80)),
        updatedAt: iso(now - days(44)),
      },
      {
        id: 'dpia-003',
        activityId: 'act-006',
        title: 'DPIA — Lokalizacja GPS floty',
        status: 'in_progress',
        criteriaMatched: ['location_tracking', 'vulnerable_subjects', 'systematic_monitoring'],
        description: 'Continuous GPS tracking of 45 delivery vehicles during working hours, linked to driver identity for route verification.',
        necessity: 'Draft — proportionality of continuous (vs. sampled) tracking still to be justified; off-duty tracking must be excluded.',
        risks: [
          { id: 'r1', description: 'Tracking outside working hours (private use of vehicles)', likelihood: 4, severity: 4, mitigation: 'Proposed: automatic tracking cut-off outside shifts', residualLikelihood: 2, residualSeverity: 4 },
          { id: 'r2', description: 'Use of location data for undisclosed performance evaluation', likelihood: 3, severity: 4, mitigation: 'Purpose limitation policy; access restricted to dispatch team', residualLikelihood: 2, residualSeverity: 3 },
        ],
        measures: ['Shift-based tracking cut-off (proposed)', 'Purpose-limitation policy (draft)'],
        dpoAdvice: 'Residual risk for off-duty tracking remains high until the cut-off is implemented. If it cannot be implemented before launch, prior consultation with UODO under Art. 36(1) is required.',
        priorConsultation: true,
        approvals: [
          { role: 'PRIVACYPILOT_DPO', name: 'Janusz Nowak', approvedAt: null },
          { role: 'PRIVACYPILOT_ADMIN', name: 'Karolina Wójcik', approvedAt: null },
        ],
        createdAt: iso(now - days(14)),
        updatedAt: iso(now - days(1)),
      },
    ],

    vendors: [
      { id: 'ven-comarch',    name: 'Comarch S.A. (Optima ERP)',      country: 'Poland',  region: 'EU (Krakow, PL)',        dpaStatus: 'signed',        subprocessors: ['Comarch Data Center PL'], riskLevel: 'low',    lastReviewAt: iso(now - days(90)) },
      { id: 'ven-erecruiter', name: 'eRecruiter Sp. z o.o.',          country: 'Poland',  region: 'EU (Warszawa, PL)',      dpaStatus: 'signed',        subprocessors: [], riskLevel: 'low',    lastReviewAt: iso(now - days(120)) },
      { id: 'ven-aws',        name: 'Amazon Web Services EMEA SARL',  country: 'Luxembourg', region: 'EU (eu-central-1 Frankfurt)', dpaStatus: 'signed', subprocessors: ['AWS subprocessor list (public)'], riskLevel: 'low', lastReviewAt: iso(now - days(60)) },
      { id: 'ven-mailchimp',  name: 'Mailchimp (Intuit Inc.)',        country: 'USA',     region: 'US data centers',        dpaStatus: 'in_negotiation', subprocessors: ['Intuit group'], riskLevel: 'high',  lastReviewAt: iso(now - days(30)) },
      { id: 'ven-logistrack', name: 'LogisTrack GPS Sp. z o.o.',      country: 'Poland',  region: 'EU (Poznan, PL)',        dpaStatus: 'missing',       subprocessors: [], riskLevel: 'medium', lastReviewAt: null },
    ],

    transfers: [
      {
        id: 'trf-001',
        vendorId: 'ven-mailchimp',
        activityId: 'act-005',
        destinationCountry: 'USA',
        recipient: 'Mailchimp (Intuit Inc.)',
        mechanism: 'scc',
        adequacyNote: 'Intuit is not certified under the EU-US Data Privacy Framework — SCCs (2021/914) module 2 used.',
        tiaDocumented: false,
        tiaRef: '',
        createdAt: iso(now - days(60)),
      },
      {
        id: 'trf-002',
        vendorId: null,
        activityId: 'act-001',
        destinationCountry: 'United Kingdom',
        recipient: 'UK payroll consultant (group company)',
        mechanism: 'adequacy',
        adequacyNote: 'UK adequacy decision renewed December 2025.',
        tiaDocumented: true,
        tiaRef: 'TIA-2026-01 (not required for adequacy, documented voluntarily)',
        createdAt: iso(now - days(100)),
      },
    ],

    breaches: [
      {
        id: 'br-001',
        title: 'Lost laptop with HR spreadsheets',
        status: 'open',
        discoveredAt: iso(now - hours(30)),
        description: 'Company laptop lost on train Warszawa–Poznan. Disk contains payroll exports for ~180 employees. Disk is BitLocker-encrypted; password not stored with device.',
        dataCategories: ['identity', 'financial', 'employment'],
        subjectsCount: 180,
        riskLevel: 'medium',
        uodoNotificationRequired: true,
        uodoNotifiedAt: null,
        subjectsNotificationRequired: false,
        riskRationale: 'Encryption reduces risk (Art. 34(3)(a)) so subject communication is not required, but confidentiality breach of unencrypted backup copy is unconfirmed — UODO notification prepared as precaution.',
        remediation: [
          { id: 'rm1', text: 'Remote wipe issued via MDM', done: true },
          { id: 'rm2', text: 'Confirm no unencrypted backup existed on device', done: false },
          { id: 'rm3', text: 'Submit UODO notification (Art. 33(3) content)', done: false },
        ],
        createdAt: iso(now - hours(29)),
        updatedAt: iso(now - hours(2)),
      },
      {
        id: 'br-002',
        title: 'Misdirected e-mail with one client contract',
        status: 'closed',
        discoveredAt: iso(now - days(40)),
        description: 'Sales employee sent a contract PDF (name, address, NIP of one sole trader) to a wrong but known counterparty, who confirmed deletion in writing.',
        dataCategories: ['identity', 'contact'],
        subjectsCount: 1,
        riskLevel: 'low',
        uodoNotificationRequired: false,
        uodoNotifiedAt: null,
        subjectsNotificationRequired: false,
        riskRationale: 'Unlikely to result in a risk to rights and freedoms (single recipient, deletion confirmed) — not notified per Art. 33(1); documented in this register per Art. 33(5).',
        remediation: [
          { id: 'rm1', text: 'Deletion confirmation archived', done: true },
          { id: 'rm2', text: 'Autocomplete disabled for external domains', done: true },
        ],
        createdAt: iso(now - days(40)),
        updatedAt: iso(now - days(38)),
      },
    ],

    dsars: [
      {
        id: 'dsar-001',
        type: 'access',
        requesterName: 'Tomasz Mazur',
        requesterEmail: 'tomasz.mazur@example.com',
        relation: 'Former employee',
        receivedAt: iso(now - days(18)),
        dueAt: iso(now + days(12)),
        extended: false,
        status: 'in_progress',
        identityVerified: true,
        identityMethod: 'Reply from e-mail address on file + employee ID number',
        tasks: [
          { id: 't1', text: 'Export personnel file (Comarch Optima)', done: true },
          { id: 't2', text: 'Export payroll history', done: true },
          { id: 't3', text: 'Check CCTV footage retention (likely already deleted)', done: false },
          { id: 't4', text: 'Prepare response letter with Art. 15(1)-(3) information', done: false },
        ],
        notes: '',
        createdAt: iso(now - days(18)),
        updatedAt: iso(now - days(2)),
      },
      {
        id: 'dsar-002',
        type: 'erasure',
        requesterName: 'Anna Krajewska',
        requesterEmail: 'anna.krajewska@example.com',
        relation: 'Newsletter subscriber',
        receivedAt: iso(now - days(35)),
        dueAt: iso(now + days(55)),
        extended: true,
        extensionReason: 'Complex verification: data present in three systems including archived backups; requester informed of extension on day 20 (Art. 12(3)).',
        status: 'in_progress',
        identityVerified: true,
        identityMethod: 'Confirmation link sent to subscribed e-mail address',
        tasks: [
          { id: 't1', text: 'Remove from Mailchimp audience', done: true },
          { id: 't2', text: 'Remove from CRM', done: true },
          { id: 't3', text: 'Schedule backup rotation purge', done: false },
        ],
        notes: '',
        createdAt: iso(now - days(35)),
        updatedAt: iso(now - days(5)),
      },
      {
        id: 'dsar-003',
        type: 'portability',
        requesterName: 'Grzegorz Adamczyk',
        requesterEmail: 'g.adamczyk@example.com',
        relation: 'Customer',
        receivedAt: iso(now - days(50)),
        dueAt: iso(now - days(20)),
        extended: false,
        status: 'completed',
        completedAt: iso(now - days(25)),
        identityVerified: true,
        identityMethod: 'Verified via customer portal login',
        tasks: [
          { id: 't1', text: 'Export order history (JSON + CSV)', done: true },
          { id: 't2', text: 'Deliver via secure download link', done: true },
        ],
        notes: 'Delivered 5 days before deadline.',
        createdAt: iso(now - days(50)),
        updatedAt: iso(now - days(25)),
      },
    ],

    notices: [
      {
        id: 'not-001',
        audience: 'employees',
        language: 'pl',
        version: 1,
        title: 'Klauzula informacyjna dla pracowników',
        generatedAt: iso(now - days(60)),
        generatedBy: 'Janusz Nowak',
        activityIds: ['act-001', 'act-003'],
        content: '',  // regenerated on demand; kept for version history
      },
    ],

    audit: [
      {
        id: 'aud-seed-1',
        at: iso(now - days(1)),
        actorName: 'Karolina Wójcik',
        actorRole: 'PRIVACYPILOT_ADMIN',
        action: 'UPDATE',
        entityType: 'activity',
        entityId: 'act-006',
        entityLabel: 'Lokalizacja GPS floty (fleet tracking)',
        oldValue: { retentionPeriod: '24 months' },
        newValue: { retentionPeriod: '12 months' },
        userAgent: 'seed',
      },
      {
        id: 'aud-seed-2',
        at: iso(now - days(2)),
        actorName: 'Marek Zieliński',
        actorRole: 'PRIVACYPILOT_COMPLIANCE_OFFICER',
        action: 'CREATE',
        entityType: 'breach',
        entityId: 'br-001',
        entityLabel: 'Lost laptop with HR spreadsheets',
        oldValue: null,
        newValue: { status: 'open' },
        userAgent: 'seed',
      },
    ],
  };
}
