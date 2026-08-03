// What each WorkPulse job title is allowed to DO — the browser-side copy.
//
// ───────────────────────────────────────────────────────────────────────────────
// READ THIS FIRST
// ───────────────────────────────────────────────────────────────────────────────
// This file only decides what the screen SHOWS. It is NOT security.
//
// The real gate is the backend (WorkPulse/backend/src/config/permissions.js),
// which refuses the API call no matter what the browser does. Anyone can edit
// JavaScript in their own browser, so a hidden menu item is a convenience, never
// a protection. We hide things here for two honest reasons:
//   1. A page that only fills with "not allowed" errors is a bad experience.
//   2. Fewer wrong turns means fewer support tickets.
//
// The two tables below MUST stay identical to the backend ones. If you change a
// rule, change it in BOTH places, or the screen will offer actions the server
// then refuses.
//
// ───────────────────────────────────────────────────────────────────────────────
// WHY THE ROLES DIFFER (short version — full legal reasoning is in the backend)
// ───────────────────────────────────────────────────────────────────────────────
//   - Working time records are legal evidence (Kodeks pracy art. 149), so READING
//     every record and CHANGING one are separate permissions.
//   - An auditor reads everything and changes nothing. An auditor who could edit
//     records could create the result they then sign off.
//   - Approving overtime commits the employer legally (art. 151 caps it), so it is
//     never something an auditor or an employee can do.
//   - Pregnancy / young-worker / parent flags are special-category data (GDPR
//     art. 9), kept to HR and admins only.
//   - Only an ADMIN may change the working-time system: it lives in the workplace
//     rules (art. 150), not in one manager's hands.
//   - EVERY role can read the policy and acknowledge the monitoring notice — those
//     are duties owed to the person (art. 22(2) §7), not privileges.

// One capability = one single thing a person can do.
export const CAPABILITIES = {
  // Self-service — a person's own working time.
  CLOCK_SELF: "CLOCK_SELF",
  TIME_SELF_READ: "TIME_SELF_READ",
  ABSENCE_SELF: "ABSENCE_SELF",
  SETTLEMENT_SELF_READ: "SETTLEMENT_SELF_READ",
  MONITORING_SELF: "MONITORING_SELF",
  NOTIFICATION_SELF: "NOTIFICATION_SELF",
  POLICY_READ: "POLICY_READ",

  // Whole-tenant reading — management and audit views.
  TIME_READ_ALL: "TIME_READ_ALL",
  ABSENCE_READ_ALL: "ABSENCE_READ_ALL",
  SETTLEMENT_READ_ALL: "SETTLEMENT_READ_ALL",
  DASHBOARD_READ: "DASHBOARD_READ",

  // Writing — actions that change the legal record.
  TIME_CORRECT: "TIME_CORRECT",
  OVERTIME_DECIDE: "OVERTIME_DECIDE",
  ABSENCE_DECIDE: "ABSENCE_DECIDE",

  // Sensitive personal data (GDPR art. 9).
  PROFILE_READ: "PROFILE_READ",
  PROFILE_WRITE: "PROFILE_WRITE",

  // Employer-level configuration.
  POLICY_WRITE: "POLICY_WRITE",

  // Oversight.
  AUDIT_READ: "AUDIT_READ",
};

const C = CAPABILITIES;

// Everything a normal working person needs for their own time.
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

// Which job title gets which actions. This table IS the policy.
export const ROLE_CAPABILITIES = {
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

  // No POLICY_WRITE and no AUDIT_READ — on purpose.
  WORKPULSE_HR_ADMIN: [
    ...SELF_SERVICE,
    ...TENANT_READ,
    C.TIME_CORRECT,
    C.OVERTIME_DECIDE,
    C.ABSENCE_DECIDE,
    C.PROFILE_READ,
    C.PROFILE_WRITE,
  ],

  // Read-only. No write of any kind, no PROFILE_READ, and no clock actions.
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

  WORKPULSE_EMPLOYEE: [...SELF_SERVICE],
};

// Every job title we know about. Holding one of these gets a person through the
// front door; what they may then do comes from the table above.
export const WORKPULSE_ROLES = Object.keys(ROLE_CAPABILITIES);

/**
 * Work out everything this logged-in user may do.
 *
 * `user` is the object from getMe(). Its `permissions` list covers every app on
 * the platform, so roles we do not know about simply add nothing. Someone holding
 * two WorkPulse roles gets both sets added together.
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
    // Compare in UPPERCASE so "WorkPulse_Admin" still matches.
    const role = String(permission).toUpperCase();
    (ROLE_CAPABILITIES[role] || []).forEach((capability) => granted.add(capability));
  });

  return Array.from(granted);
};

/**
 * Quick yes/no for one action. Use this in components to decide whether to show a
 * button or a menu item.
 *
 * @param {object|null} user the logged-in user
 * @param {string} capability one of CAPABILITIES
 * @returns {boolean}
 */
export const userCan = (user, capability) =>
  Boolean(capability) && getCapabilities(user).includes(capability);
