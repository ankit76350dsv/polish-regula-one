// What each SafeWork job title is allowed to DO — the browser-side copy.
//
// ───────────────────────────────────────────────────────────────────────────────
// READ THIS FIRST
// ───────────────────────────────────────────────────────────────────────────────
// This file only decides what the screen SHOWS. It is NOT security.
//
// The real gate is the backend (safeWork/backend/src/config/permissions.js),
// which refuses the API call no matter what the browser does. Anyone can edit
// JavaScript in their own browser, so a hidden button is a convenience, never a
// protection. We hide controls here for two honest reasons:
//   1. A button that always fails with "not allowed" is a bad experience.
//   2. Fewer wrong turns means fewer support tickets.
//
// The two tables below MUST stay identical to the backend ones. If you change a
// rule, change it in BOTH files, or the screen will offer actions the server
// then refuses.
//
// ───────────────────────────────────────────────────────────────────────────────
// WHY THE ROLES DIFFER (short version — full reasoning is in the backend file)
// ───────────────────────────────────────────────────────────────────────────────
//   - Auditors read only. An auditor who could change data could manufacture the
//     result they then sign off.
//   - Auditors cannot open the certificate FILE. Status and expiry already prove
//     a valid certificate existed; the doctor's note is health data (GDPR Art. 9).
//   - Auditors read the audit log; HR does not. HR reading it would mean HR can
//     watch which colleagues opened whose records.
//   - HR may BLOCK clock-in (that enforces Polish Labour Code art. 229 §4), but
//     only an admin may UNBLOCK, because that switches a legal safety gate off.

// One capability = one single thing a person can do.
export const CAPABILITIES = {
  EMPLOYEE_READ: "EMPLOYEE_READ", // see employee records + compliance status
  EMPLOYEE_WRITE: "EMPLOYEE_WRITE", // create/edit profile details
  DOCUMENT_READ: "DOCUMENT_READ", // open the stored certificate file itself
  DOCUMENT_WRITE: "DOCUMENT_WRITE", // upload or renew a certificate
  COMPLIANCE_BLOCK: "COMPLIANCE_BLOCK", // change status / block clock-in
  COMPLIANCE_UNBLOCK: "COMPLIANCE_UNBLOCK", // remove a block (admin only)
  AUDIT_READ: "AUDIT_READ", // read the audit trail
  DASHBOARD_READ: "DASHBOARD_READ", // see the summary dashboard
  SELF_READ: "SELF_READ", // reserved: read only your own record
};

const C = CAPABILITIES;

// Which job title gets which actions. This table IS the policy.
export const ROLE_CAPABILITIES = {
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

  SAFEWORK_HR_MANAGER: [
    C.EMPLOYEE_READ,
    C.EMPLOYEE_WRITE,
    C.DOCUMENT_READ,
    C.DOCUMENT_WRITE,
    C.COMPLIANCE_BLOCK,
    C.DASHBOARD_READ,
  ],

  // Note there is no DOCUMENT_READ and no write of any kind here — on purpose.
  SAFEWORK_AUDITOR: [C.EMPLOYEE_READ, C.AUDIT_READ, C.DASHBOARD_READ],

  SAFEWORK_COMPLIANCE_OFFICER: [
    C.EMPLOYEE_READ,
    C.DOCUMENT_READ,
    C.DOCUMENT_WRITE,
    C.COMPLIANCE_BLOCK,
    C.AUDIT_READ,
    C.DASHBOARD_READ,
  ],

  // Self-service only. No page uses SELF_READ yet, so this role currently sees
  // the "you do not have access" screen — which is the safe outcome.
  SAFEWORK_EMPLOYEE: [C.SELF_READ],
};

// Every job title we know about. Holding one of these is what gets a person
// through the front door; what they can then do comes from the table above.
export const SAFEWORK_ROLES = Object.keys(ROLE_CAPABILITIES);

/**
 * Work out everything this logged-in user may do.
 *
 * `user` is the object from getMe(). Its `permissions` list covers every app on
 * the platform, so roles we do not know about simply add nothing.
 *
 * We stay defensive: a missing or broken list becomes an empty list, so a bad
 * response hides controls rather than showing ones the server will refuse.
 *
 * @param {object|null} user the logged-in user
 * @returns {string[]} capability names, no duplicates
 */
export const getCapabilities = (user) => {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];

  const granted = new Set();

  permissions.forEach((permission) => {
    // Compare in UPPERCASE so "SafeWork_Admin" still matches.
    const role = String(permission).toUpperCase();
    (ROLE_CAPABILITIES[role] || []).forEach((capability) => granted.add(capability));
  });

  return Array.from(granted);
};

/**
 * Quick yes/no for one action. Use this in components to decide whether to show
 * a button.
 *
 * @param {object|null} user the logged-in user
 * @param {string} capability one of CAPABILITIES
 * @returns {boolean}
 */
export const userCan = (user, capability) =>
  Boolean(capability) && getCapabilities(user).includes(capability);
