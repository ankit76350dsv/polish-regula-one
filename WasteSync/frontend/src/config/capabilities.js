// What each WasteSync job title is allowed to DO — the browser-side copy.
//
// ───────────────────────────────────────────────────────────────────────────────
// READ THIS FIRST
// ───────────────────────────────────────────────────────────────────────────────
// This file only decides what the screen SHOWS. It is NOT security.
//
// The real gate is the backend (WasteSync/backend/src/config/permissions.js),
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
//   - Auditors read only. An auditor who could change the waste figures could
//     create the very numbers they then sign off.
//   - Auditors CAN download the XML/PDF. That is the evidence an audit needs, it
//     changes nothing, and every download is written to the audit log.
//   - Auditors read the audit log; HR does not. HR reading it would mean HR can
//     watch which colleagues opened or corrected whose figures.
//   - HR may GENERATE an annual report, but only an admin may MARK IT SUBMITTED,
//     because that flag is the company's record of a legal filing in the
//     government BDO register.
//   - Only an admin may CHANGE A LEGAL THRESHOLD. Somebody who could both record
//     the waste and raise the limit could make any breach disappear.

// One capability = one single thing a person can do.
export const CAPABILITIES = {
  DASHBOARD_READ: "DASHBOARD_READ", // see the summary dashboard

  COMPANY_READ: "COMPANY_READ", // see the companies we report for
  COMPANY_WRITE: "COMPANY_WRITE", // add or edit a company (incl. BDO number)

  WASTE_ENTRY_READ: "WASTE_ENTRY_READ", // see monthly figures + their history
  WASTE_ENTRY_WRITE: "WASTE_ENTRY_WRITE", // record or correct a month

  REPORT_READ: "REPORT_READ", // see the reports list and one report
  REPORT_GENERATE: "REPORT_GENERATE", // build a new annual report
  REPORT_EXPORT: "REPORT_EXPORT", // download the XML / PDF file
  REPORT_SUBMIT: "REPORT_SUBMIT", // mark it filed with BDO (admin only)

  THRESHOLD_READ: "THRESHOLD_READ", // see the legal limits
  THRESHOLD_WRITE: "THRESHOLD_WRITE", // set/remove a limit (admin only)

  AUDIT_READ: "AUDIT_READ", // read the audit trail
};

const C = CAPABILITIES;

// Which job title gets which actions. This table IS the policy.
export const ROLE_CAPABILITIES = {
  WASTESYNC_ADMIN: [
    C.DASHBOARD_READ,
    C.COMPANY_READ,
    C.COMPANY_WRITE,
    C.WASTE_ENTRY_READ,
    C.WASTE_ENTRY_WRITE,
    C.REPORT_READ,
    C.REPORT_GENERATE,
    C.REPORT_EXPORT,
    C.REPORT_SUBMIT,
    C.THRESHOLD_READ,
    C.THRESHOLD_WRITE,
    C.AUDIT_READ,
  ],

  // Note there is no REPORT_SUBMIT, no THRESHOLD_WRITE and no AUDIT_READ here —
  // on purpose. See the explanation at the top of this file.
  WASTESYNC_HR_MANAGER: [
    C.DASHBOARD_READ,
    C.COMPANY_READ,
    C.COMPANY_WRITE,
    C.WASTE_ENTRY_READ,
    C.WASTE_ENTRY_WRITE,
    C.REPORT_READ,
    C.REPORT_GENERATE,
    C.REPORT_EXPORT,
    C.THRESHOLD_READ,
  ],

  // Read-only, plus the audit trail and the ability to download a report as
  // evidence. No write capability of any kind.
  WASTESYNC_AUDITOR: [
    C.DASHBOARD_READ,
    C.COMPANY_READ,
    C.WASTE_ENTRY_READ,
    C.REPORT_READ,
    C.REPORT_EXPORT,
    C.THRESHOLD_READ,
    C.AUDIT_READ,
  ],
};

// Every job title we know about. Holding one of these is what gets a person
// through the front door; what they can then do comes from the table above.
export const WASTESYNC_ROLES = Object.keys(ROLE_CAPABILITIES);

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
    // Compare in UPPERCASE so "WasteSync_Admin" still matches.
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
