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

    // DPIAs (Art. 35 risk assessments) are NO LONGER mocked. They come from the real
    // PrivacyPilot backend (DpiaController), through dpiaService.js + client.js. Kept
    // as an empty array only so any remaining mock code that reads db.dpias does not
    // crash; the DPIA screens read the real backend, not this.
    dpias: [],

    // Processors (Art. 28 vendors) are NO LONGER mocked — they come from the real
    // PrivacyPilot backend (VendorController), through vendorService.js + client.js.
    // Empty here; the Vendors page, the activity wizard's processor picker and the
    // notice builder all read the real vendors slice now.
    vendors: [],

    // Third-country transfers (Chapter V) are NO LONGER mocked — they come from the
    // real PrivacyPilot backend (TransferController), through transferService.js +
    // client.js. Empty here; the Transfers page, the activity wizard's transfer picker,
    // the activity detail page and the notice builder all read the real transfers slice.
    transfers: [],

    // Personal-data breaches (Art. 33/34) are NO LONGER mocked — they come from the
    // real PrivacyPilot backend (BreachController), through breachService.js +
    // client.js. Empty here; the Breaches list/detail pages and the dashboard's
    // breach counts / 72h clock all read the real breaches slice now.
    breaches: [],

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

    // Privacy notices are NO LONGER mocked — they come from the real PrivacyPilot
    // backend (NoticeController), through noticeService.js + client.js. The notice
    // TEXT is still compiled on the client (from the settings/transfers/vendors that
    // remain mock), but the notice records themselves live on the server. Empty here.
    notices: [],

    // The audit trail is NO LONGER mocked — it comes from the real PrivacyPilot
    // backend (AuditController), through auditService.js + client.js. This array is
    // kept only so the modules still on the mock (which append an entry via
    // apiMutate) do not crash when they write; it starts empty and those writes are
    // never displayed (the audit screen reads the real backend). Remove it once every
    // module is wired to the real backend.
    audit: [],
  };
}
