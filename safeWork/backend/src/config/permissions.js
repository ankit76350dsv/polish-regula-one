// SafeWork access rules — the ONE place that says who may do what.
//
// ───────────────────────────────────────────────────────────────────────────────
// HOW THIS WORKS (two layers, on purpose)
// ───────────────────────────────────────────────────────────────────────────────
//
// Layer 1 — ROLE: the job title the central RegulaOne login gives a person.
//   The GET /api/auth/me response contains a "permissions" list like:
//     ["KSEF_ADMIN", "SAFEWORK_HR_MANAGER", "PRIVACYPILOT_DPO", ...]
//   That list covers every app on the platform, so we only look at SAFEWORK_ ones.
//
// Layer 2 — CAPABILITY: one single thing a person is allowed to DO, such as
//   "read an employee record" or "upload a certificate".
//
// Each route checks a CAPABILITY, never a job title. Why that matters:
//   - Job titles are broad. "Is the caller an admin?" cannot express
//     "auditors may look but never change anything".
//   - When the business changes its mind about what HR may do, we edit ONE
//     table below instead of hunting through every route file.
//   - During an audit we can print this table and it IS the access policy.
//
// ───────────────────────────────────────────────────────────────────────────────
// WHY THE ROLES DIFFER (the reasoning, so nobody "simplifies" it later)
// ───────────────────────────────────────────────────────────────────────────────
//
// * An AUDITOR can only READ. If an auditor could change compliance data they
//   could create the very situation they then sign off as correct. Read-only is
//   what makes their sign-off worth anything (separation of duties).
//
// * An AUDITOR may NOT open the medical certificate file itself. Their job is to
//   prove "a valid certificate existed on this date" — the status, the expiry
//   date and the upload trail already prove that. The doctor's certificate is
//   health data (GDPR Article 9), so opening it would expose sensitive personal
//   data for no extra benefit. That is data minimisation (GDPR Article 5(1)(c)).
//
// * An AUDITOR may read the audit log; HR may NOT. Reading the audit trail is
//   the auditor's whole job. If HR could read it, HR could watch which
//   colleagues looked at whose records — that is staff surveillance with no work
//   reason behind it.
//
// * BLOCKING clock-in is safe for HR to do; UNBLOCKING is admin-only.
//   Polish Labour Code Article 229 §4 says an employer must NOT let someone work
//   without a valid medical certificate (Article 237(3) is the same idea for BHP
//   safety training). Blocking enforces that law, so HR may always block.
//   Unblocking switches a legal safety gate off, so only an admin may do it, and
//   they must give a written reason that is stored in the audit log.
//
// * Nobody can edit the audit log. That is not a permission, it is built into
//   the database model (see models/AuditLog.js) and must stay that way.
//
// * Nobody here can hand out SafeWork access. Only the central RegulaOne tenant
//   admin can do that, so SafeWork can never widen its own access.
//
// SOURCES TO RE-CONFIRM BEFORE ANY CHANGE TO THE BLOCK/UNBLOCK RULE
//   - Kodeks pracy art. 229 (medical examinations) and art. 237(3) (BHP training)
//     via the official portal isap.sejm.gov.pl / gov.pl
//   - GDPR (RODO) Art. 5(1)(c), Art. 9, Art. 32

const config = require('./environment');

// ── Layer 2: the single actions a person can be allowed to do ────────────────
// Keep these small and specific. One capability = one kind of action.
const CAPABILITIES = {
  // See employee records and their compliance status (no file contents).
  EMPLOYEE_READ: 'EMPLOYEE_READ',
  // Create or change an employee's profile details (department, contract, risk).
  EMPLOYEE_WRITE: 'EMPLOYEE_WRITE',
  // Open/download the stored certificate FILE itself (health data — sensitive).
  DOCUMENT_READ: 'DOCUMENT_READ',
  // Upload a new or renewed certificate file.
  DOCUMENT_WRITE: 'DOCUMENT_WRITE',
  // Change compliance status, including BLOCKING someone from clocking in.
  COMPLIANCE_BLOCK: 'COMPLIANCE_BLOCK',
  // Remove a block — switches off a legal safety gate, so it is separate.
  COMPLIANCE_UNBLOCK: 'COMPLIANCE_UNBLOCK',
  // Read the audit trail (who did what, and when).
  AUDIT_READ: 'AUDIT_READ',
  // See the summary dashboard (counts, expiring lists, recent activity).
  DASHBOARD_READ: 'DASHBOARD_READ',
  // Read ONLY your own record. Reserved for employee self-service.
  // No endpoint uses it yet, because no endpoint limits results to "just me".
  // Do NOT map it onto an existing route — that would show one employee
  // everyone else's health data.
  SELF_READ: 'SELF_READ',
};

const C = CAPABILITIES;

// ── Layer 1 → Layer 2: which job title gets which actions ────────────────────
// This table IS the access policy. Read it top to bottom to answer
// "what may this person do?".
const ROLE_CAPABILITIES = {
  // Full control of the module, including the admin-only unblock override.
  SAFEWORK_ADMIN: [
    C.EMPLOYEE_READ,
    C.EMPLOYEE_WRITE,
    C.DOCUMENT_READ,
    C.DOCUMENT_WRITE,
    C.COMPLIANCE_BLOCK,
    C.COMPLIANCE_UNBLOCK,
    C.AUDIT_READ,
    C.DASHBOARD_READ,
  ],

  // Day-to-day HR work: keep profiles up to date, collect and renew
  // certificates, and block anyone whose certificate has run out.
  // NOT allowed: removing a block, and reading the audit trail.
  SAFEWORK_HR_MANAGER: [
    C.EMPLOYEE_READ,
    C.EMPLOYEE_WRITE,
    C.DOCUMENT_READ,
    C.DOCUMENT_WRITE,
    C.COMPLIANCE_BLOCK,
    C.DASHBOARD_READ,
  ],

  // Read-only, and deliberately WITHOUT DOCUMENT_READ so the auditor never
  // opens a doctor's certificate. They can still see status, expiry date and
  // the full audit trail, which is what an audit actually needs.
  SAFEWORK_AUDITOR: [
    C.EMPLOYEE_READ,
    C.AUDIT_READ,
    C.DASHBOARD_READ,
  ],

  // Sits between HR and the auditor: watches compliance and can act on it,
  // but does not edit employment profile details.
  // Included ready for the day RegulaOne starts issuing this name for SafeWork.
  SAFEWORK_COMPLIANCE_OFFICER: [
    C.EMPLOYEE_READ,
    C.DOCUMENT_READ,
    C.DOCUMENT_WRITE,
    C.COMPLIANCE_BLOCK,
    C.AUDIT_READ,
    C.DASHBOARD_READ,
  ],

  // Employee self-service. Holds ONLY SELF_READ, which no route accepts yet,
  // so today this role can log in and is then told it has no access. That is
  // the safe outcome until an "only my own record" endpoint exists.
  SAFEWORK_EMPLOYEE: [
    C.SELF_READ,
  ],
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

  // A single permission sent as plain text — put it in a list of one.
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
 * The SafeWork job titles this deployment recognises.
 *
 * Normally this is every role in the table above. An environment may narrow the
 * list with SAFEWORK_ALLOWED_PERMISSIONS (see config/environment.js) — useful
 * while the platform is still rolling a new role out. A name that is not in the
 * table is ignored even if the environment lists it, because we would not know
 * what that person is allowed to do.
 */
const ROLES_WITH_ACCESS = (() => {
  const known = Object.keys(ROLE_CAPABILITIES);
  const configured = normalizePermissions(config.safework.allowedPermissions);

  // Nothing configured -> recognise every role we have a policy for.
  if (configured.length === 0) return known;

  const recognised = configured.filter((role) => known.includes(role));

  // A name in the environment that we have no policy for is almost always a typo
  // or a leftover from a rename. We do NOT guess what it was meant to be — that
  // could hand out access by accident — but we must say so out loud, because a
  // silent mismatch would look like "the app is broken" instead of "the config is
  // wrong". Startup warnings are the cheapest place to catch this.
  const ignored = configured.filter((role) => !known.includes(role));
  if (ignored.length > 0) {
    console.warn(
      `[PERMISSIONS] Ignoring unknown role name(s) in SAFEWORK_ALLOWED_PERMISSIONS: ${ignored.join(', ')}. ` +
        `Known SafeWork roles are: ${known.join(', ')}.`
    );
  }

  // Nothing usable was configured. Every request will now be refused, which is
  // the safe outcome, but it is almost certainly a mistake — so shout about it.
  if (recognised.length === 0) {
    console.error(
      '[PERMISSIONS] SAFEWORK_ALLOWED_PERMISSIONS matched no known SafeWork role. ' +
        'Every SafeWork API request will be refused until this is fixed.'
    );
  }

  return recognised;
})();

// Older name for the same list, kept so existing imports keep working.
const ALLOWED_PERMISSIONS = ROLES_WITH_ACCESS;

/**
 * Does this user hold at least one recognised SafeWork role?
 *
 * This is only the front door ("may you use SafeWork at all?"). What the person
 * can actually do is decided per route by capabilities.
 *
 * @param {string[]} userPermissions already-normalised permissions of the caller
 * @param {string[]} [required] roles that grant entry (defaults to the recognised list)
 * @returns {boolean} true only when there is a real match
 */
function hasAnyPermission(userPermissions, required = ROLES_WITH_ACCESS) {
  // No user permissions, or nothing configured as "allowed" -> refuse.
  // An empty `required` list must never mean "everyone is allowed".
  if (!Array.isArray(userPermissions) || userPermissions.length === 0) return false;
  if (!Array.isArray(required) || required.length === 0) return false;

  const held = new Set(userPermissions);
  return required.some((permission) => held.has(permission));
}

/**
 * Work out everything this person is allowed to DO.
 *
 * We look at each SafeWork role they hold and collect the capabilities of all of
 * them. Someone with two roles simply gets both sets added together, and a role
 * we do not recognise adds nothing.
 *
 * @param {string[]} userPermissions already-normalised permissions of the caller
 * @returns {string[]} the capabilities this person has, with no duplicates
 */
function resolveCapabilities(userPermissions) {
  if (!Array.isArray(userPermissions) || userPermissions.length === 0) return [];

  const granted = new Set();

  for (const role of userPermissions) {
    // Skip roles this deployment does not recognise (see ROLES_WITH_ACCESS).
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
 * @param {string} capability the action being attempted, e.g. DOCUMENT_READ
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
