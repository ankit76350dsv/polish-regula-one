// WorkPulse access rules — the ONE place that says who may do what.
//
// ───────────────────────────────────────────────────────────────────────────────
// HOW THIS WORKS (two layers, on purpose)
// ───────────────────────────────────────────────────────────────────────────────
//
// Layer 1 — ROLE: the job title the central RegulaOne login gives a person.
//   GET /api/auth/me returns a "permissions" list covering every app on the
//   platform, for example:
//     ["KSEF_ADMIN", "WORKPULSE_HR_ADMIN", "SAFEWORK_AUDITOR", ...]
//   We only look at the WORKPULSE_ entries and ignore the rest.
//
// Layer 2 — CAPABILITY: one single thing a person is allowed to DO, such as
//   "clock myself in" or "approve overtime".
//
// Each route checks a CAPABILITY, never a job title. Why that matters:
//   - A job title is too broad to express "an auditor may read every time record
//     but must never change one".
//   - When the business changes what HR may do, we edit ONE table below instead
//     of hunting through ten route files.
//   - During a labour inspection or an ISO audit we can print this table and it
//     IS the access policy.
//
// ───────────────────────────────────────────────────────────────────────────────
// WHY THE ROLES DIFFER — the legal reasoning
// ───────────────────────────────────────────────────────────────────────────────
//
// Polish Labour Code (Kodeks pracy) references. Confirm the exact wording on the
// official portal (isap.sejm.gov.pl / gov.pl / pip.gov.pl) before changing any of
// these rules — see CLAUDE.md section 24.
//
// * WORKING TIME RECORDS ARE LEGAL EVIDENCE (art. 149 §1: the employer must keep
//   a record of each employee's working time). A record that anyone could quietly
//   change is worthless in front of a labour inspector (PIP). So:
//     - reading every record  -> a management/audit action
//     - CHANGING a record     -> a separate, stronger capability, and the code
//       already forces a written reason on every correction
//     - an AUDITOR can read everything and change nothing. An auditor who could
//       edit records could create the very result they then sign off.
//
// * OVERTIME IS CAPPED BY LAW (art. 151 §3: 150 hours per year per employee
//   unless the workplace rules say otherwise; art. 131: the average week must not
//   exceed 48 hours including overtime). Approving overtime therefore commits the
//   employer legally, so it needs its own capability — never something an auditor
//   or an employee can do.
//
// * PROTECTED-STATUS DATA IS SPECIAL-CATEGORY DATA. The employee work profile
//   holds pregnancy, young-worker and parent-of-a-small-child flags, because the
//   law bans or limits overtime and night work for those groups (art. 178 for
//   pregnant employees and parents of children under 4; art. 203 for young
//   workers). Pregnancy and health are Article 9 GDPR data, so only HR and admins
//   may read or write these flags. An auditor checks that the LIMITS were
//   respected, which the time records and violation reports already show — they do
//   not need to know who is pregnant (GDPR art. 5(1)(c) data minimisation).
//
// * THE WORKING-TIME SYSTEM IS AN EMPLOYER-LEVEL DECISION (art. 150: the system
//   and settlement period are set in the workplace rules / collective agreement).
//   Switching a tenant from a standard to an equivalent system changes how every
//   future hour is judged, so only an ADMIN may write the policy. Everyone may
//   READ it, because the clock screen has to show people the norm that applies to
//   them.
//
// * MONITORING MUST BE ANNOUNCED (art. 22(2) §7: employees must be informed about
//   monitoring before it starts). So EVERY role can see and acknowledge the
//   monitoring notice — that is a legal information duty owed to the person, not a
//   privilege.
//
// * READING THE AUDIT TRAIL is the auditor's job, and the admin's. HR is left out
//   on purpose: it would let HR watch which colleagues looked at whose records,
//   which is staff surveillance with no work reason behind it.
//
// * NOBODY EDITS THE AUDIT LOG. That is not a permission — it is built into the
//   database model (models/AuditLog.js blocks all updates) and must stay that way.

const config = require('./environment');

// ── Layer 2: the single actions a person can be allowed to do ────────────────
const CAPABILITIES = {
  // ── Self-service: things a person does with their OWN working time ─────────
  // These endpoints only ever touch the caller's own records, because the
  // controllers read the user from the session and never from the request body.
  CLOCK_SELF: 'CLOCK_SELF', // clock in/out, start/end my own break
  TIME_SELF_READ: 'TIME_SELF_READ', // my status, my eligibility, my own entries
  ABSENCE_SELF: 'ABSENCE_SELF', // request my own leave and list my own absences
  SETTLEMENT_SELF_READ: 'SETTLEMENT_SELF_READ', // my own settlement-period balance
  MONITORING_SELF: 'MONITORING_SELF', // see and acknowledge the monitoring notice
  NOTIFICATION_SELF: 'NOTIFICATION_SELF', // my own alert inbox
  POLICY_READ: 'POLICY_READ', // read the working-time norm that applies to me

  // ── Whole-tenant reading: management and audit views ──────────────────────
  TIME_READ_ALL: 'TIME_READ_ALL', // every employee's time records
  ABSENCE_READ_ALL: 'ABSENCE_READ_ALL', // every employee's absence requests
  SETTLEMENT_READ_ALL: 'SETTLEMENT_READ_ALL', // the tenant-wide reconciliation report
  DASHBOARD_READ: 'DASHBOARD_READ', // workforce dashboard and monthly summaries

  // ── Writing: actions that change the legal record ─────────────────────────
  TIME_CORRECT: 'TIME_CORRECT', // change a stored time entry (reason required)
  OVERTIME_DECIDE: 'OVERTIME_DECIDE', // approve or reject overtime
  ABSENCE_DECIDE: 'ABSENCE_DECIDE', // approve or reject a leave request

  // ── Sensitive personal data (GDPR art. 9) ─────────────────────────────────
  PROFILE_READ: 'PROFILE_READ', // read pregnancy / young worker / consent flags
  PROFILE_WRITE: 'PROFILE_WRITE', // change those flags

  // ── Employer-level configuration ──────────────────────────────────────────
  POLICY_WRITE: 'POLICY_WRITE', // change the working-time system for the tenant

  // ── Oversight ─────────────────────────────────────────────────────────────
  AUDIT_READ: 'AUDIT_READ', // read the immutable audit trail
};

const C = CAPABILITIES;

// Everything a normal working person needs for their own time. Listed once and
// reused below, so the four roles cannot drift apart by accident.
const SELF_SERVICE = [
  C.CLOCK_SELF,
  C.TIME_SELF_READ,
  C.ABSENCE_SELF,
  C.SETTLEMENT_SELF_READ,
  C.MONITORING_SELF,
  C.NOTIFICATION_SELF,
  C.POLICY_READ,
];

// Read-only view over the whole workforce.
const TENANT_READ = [
  C.TIME_READ_ALL,
  C.ABSENCE_READ_ALL,
  C.SETTLEMENT_READ_ALL,
  C.DASHBOARD_READ,
];

// ── Layer 1 → Layer 2: which job title gets which actions ────────────────────
// This table IS the access policy. Read it top to bottom to answer
// "what may this person do?".
const ROLE_CAPABILITIES = {
  // Full control of the module. The only role that may change the working-time
  // policy, because that is an employer-level decision under art. 150.
  WORKPULSE_ADMIN: [
    ...SELF_SERVICE,
    ...TENANT_READ,
    C.TIME_CORRECT,
    C.OVERTIME_DECIDE,
    C.ABSENCE_DECIDE,
    C.PROFILE_READ,
    C.PROFILE_WRITE,
    C.POLICY_WRITE,
    C.AUDIT_READ,
  ],

  // Day-to-day HR work: watch the workforce, fix wrong time entries (with a
  // written reason), decide overtime and leave, and keep the protected-status
  // flags up to date.
  // NOT allowed: changing the tenant's working-time system, and reading the
  // audit trail.
  WORKPULSE_HR_ADMIN: [
    ...SELF_SERVICE,
    ...TENANT_READ,
    C.TIME_CORRECT,
    C.OVERTIME_DECIDE,
    C.ABSENCE_DECIDE,
    C.PROFILE_READ,
    C.PROFILE_WRITE,
  ],

  // Read-only oversight. Can read every time record, every absence and the full
  // audit trail — which is exactly what proving compliance with art. 149 needs —
  // and can change nothing at all.
  //
  // Deliberately WITHOUT:
  //   - any write capability (an auditor who can edit cannot audit)
  //   - PROFILE_READ, so pregnancy and health flags stay with HR
  //   - CLOCK_SELF, so the person verifying working-time records is not also
  //     producing them. Someone who both audits AND works simply holds
  //     WORKPULSE_EMPLOYEE as well; capabilities from several roles add together.
  WORKPULSE_AUDITOR: [
    C.TIME_READ_ALL,
    C.ABSENCE_READ_ALL,
    C.SETTLEMENT_READ_ALL,
    C.DASHBOARD_READ,
    C.AUDIT_READ,
    C.POLICY_READ,
    C.MONITORING_SELF,
    C.NOTIFICATION_SELF,
  ],

  // A normal worker: clock in and out, look at their own timesheet, ask for
  // leave, read the working-time norm, and acknowledge the monitoring notice.
  // They can never see another person's records.
  WORKPULSE_EMPLOYEE: [...SELF_SERVICE],
};

/**
 * Turn whatever RegulaOne sent us into a clean list of UPPERCASE text values.
 *
 * We are deliberately careful here because this list decides who gets in:
 *   - the field may be missing entirely            -> treat as "no permissions"
 *   - it may be a single string instead of a list  -> wrap it in a list
 *   - an entry may be an object like { name: "X" } -> read the text out of it
 *   - entries may differ in letter case            -> compare in UPPERCASE
 *
 * Anything we cannot understand is dropped rather than trusted, so a strange
 * response can never accidentally grant access (this is called "fail closed").
 *
 * @param {*} value raw permissions value from the /api/auth/me response
 * @returns {string[]} clean, uppercase permission names
 */
function normalizePermissions(value) {
  if (!value) return [];

  const rawList = Array.isArray(value) ? value : [value];

  return rawList
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      // Some services send objects instead of plain text. Read the usual field
      // names; if none of them exist we return null and drop the entry below.
      if (entry && typeof entry === 'object') {
        return entry.name || entry.permission || entry.authority || entry.code || null;
      }
      return null;
    })
    .filter((name) => typeof name === 'string' && name.trim().length > 0)
    .map((name) => name.trim().toUpperCase());
}

/**
 * The WorkPulse job titles this deployment recognises.
 *
 * Normally every role in the table above. An environment may narrow the list
 * with WORKPULSE_ALLOWED_PERMISSIONS (see config/environment.js) — useful while a
 * new role is still being rolled out. A name that is not in the table is ignored
 * even if the environment lists it, because we would not know what that person is
 * allowed to do.
 */
const ROLES_WITH_ACCESS = (() => {
  const known = Object.keys(ROLE_CAPABILITIES);
  const configured = normalizePermissions(config.workpulse.allowedPermissions);

  if (configured.length === 0) return known;

  const recognised = configured.filter((role) => known.includes(role));

  // A name we have no policy for is almost always a typo or a leftover from a
  // rename. We do NOT guess what it meant — that could hand out access by
  // accident — but we say so loudly, because a silent mismatch looks like "the
  // app is broken" instead of "the config is wrong".
  const ignored = configured.filter((role) => !known.includes(role));
  if (ignored.length > 0) {
    console.warn(
      `[PERMISSIONS] Ignoring unknown role name(s) in WORKPULSE_ALLOWED_PERMISSIONS: ${ignored.join(', ')}. ` +
        `Known WorkPulse roles are: ${known.join(', ')}.`
    );
  }

  if (recognised.length === 0) {
    console.error(
      '[PERMISSIONS] WORKPULSE_ALLOWED_PERMISSIONS matched no known WorkPulse role. ' +
        'Every WorkPulse API request will be refused until this is fixed.'
    );
  }

  return recognised;
})();

// Older name for the same list, kept so existing imports keep working.
const ALLOWED_PERMISSIONS = ROLES_WITH_ACCESS;

/**
 * Does this user hold at least one recognised WorkPulse role?
 *
 * This is only the front door ("may you use WorkPulse at all?"). What the person
 * can actually do is decided per route by capabilities.
 *
 * @param {string[]} userPermissions already-normalised permissions of the caller
 * @param {string[]} [required] roles that grant entry (defaults to the recognised list)
 * @returns {boolean} true only when there is a real match
 */
function hasAnyPermission(userPermissions, required = ROLES_WITH_ACCESS) {
  // An empty list on either side must never mean "everyone is allowed".
  if (!Array.isArray(userPermissions) || userPermissions.length === 0) return false;
  if (!Array.isArray(required) || required.length === 0) return false;

  const held = new Set(userPermissions);
  return required.some((permission) => held.has(permission));
}

/**
 * Work out everything this person is allowed to DO.
 *
 * We look at each WorkPulse role they hold and collect the capabilities of all of
 * them, so somebody who is both an auditor and an employee simply gets both sets
 * added together. A role we do not recognise adds nothing.
 *
 * @param {string[]} userPermissions already-normalised permissions of the caller
 * @returns {string[]} the capabilities this person has, with no duplicates
 */
function resolveCapabilities(userPermissions) {
  if (!Array.isArray(userPermissions) || userPermissions.length === 0) return [];

  const granted = new Set();

  for (const role of userPermissions) {
    if (!ROLES_WITH_ACCESS.includes(role)) continue;

    for (const capability of ROLE_CAPABILITIES[role] || []) {
      granted.add(capability);
    }
  }

  return Array.from(granted);
}

/**
 * Is this person allowed to do this one thing?
 *
 * @param {string[]} userCapabilities result of resolveCapabilities()
 * @param {string} capability the action being attempted, e.g. TIME_CORRECT
 * @returns {boolean}
 */
function hasCapability(userCapabilities, capability) {
  if (!Array.isArray(userCapabilities) || !capability) return false;
  return userCapabilities.includes(capability);
}

module.exports = {
  CAPABILITIES,
  ROLE_CAPABILITIES,
  ROLES_WITH_ACCESS,
  ALLOWED_PERMISSIONS,
  normalizePermissions,
  hasAnyPermission,
  resolveCapabilities,
  hasCapability,
};
