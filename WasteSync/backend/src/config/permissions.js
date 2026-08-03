// WasteSync access rules — the ONE place that says who may do what.
//
// ───────────────────────────────────────────────────────────────────────────────
// HOW THIS WORKS (two layers, on purpose)
// ───────────────────────────────────────────────────────────────────────────────
//
// Layer 1 — ROLE: the job title the central RegulaOne login gives a person.
//   The GET /api/auth/me response contains a "permissions" list like:
//     ["KSEF_ADMIN", "WASTESYNC_HR_MANAGER", "SAFEWORK_AUDITOR", ...]
//   That list covers every app on the platform, so we only look at WASTESYNC_ ones.
//
// Layer 2 — CAPABILITY: one single thing a person is allowed to DO, such as
//   "read a company record" or "mark a report as submitted to BDO".
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
// * An AUDITOR can only READ. WasteSync produces the figures a company files with
//   a government register. If an auditor could change those figures they could
//   create the very numbers they then sign off as correct. Read-only is what makes
//   their sign-off worth anything (separation of duties).
//
// * An AUDITOR MAY download the generated XML and PDF. That is not a change to the
//   data — it is the evidence pack an audit actually needs, and every download is
//   written to the audit log, so the copy is traceable.
//
// * An AUDITOR may read the audit log; HR may NOT. Reading the audit trail is the
//   auditor's whole job. If HR could read it, HR could watch which colleagues
//   opened or corrected whose figures — staff surveillance with no work reason.
//
// * HR may GENERATE a report; only an ADMIN may MARK IT SUBMITTED.
//   Generating builds the XML/PDF from data we already hold — safe, repeatable,
//   and it changes nothing outside our own database. "Submitted" is different: it
//   is this company's own record saying the annual waste report was filed in the
//   government BDO register by the legal deadline. If that flag were wrong, the
//   company would believe it had filed when it had not, and would only find out
//   when the authority asked. Filing is the employer's declaration, so confirming
//   it stays with an admin — the same reasoning that makes "remove a compliance
//   block" admin-only in SafeWork.
//
// * Only an ADMIN may change the LEGAL THRESHOLDS. Those numbers are the limits
//   every report is checked against. Somebody who could both record the waste
//   figures AND raise the limit could make any breach disappear, so the two powers
//   are deliberately held by different people. HR and auditors can still READ the
//   limits, which is what they need to understand a report.
//
// * Nobody can edit the audit log. That is not a permission, it is built into the
//   database model (see models/AuditLog.js) and must stay that way.
//
// * Nobody here can hand out WasteSync access. Only the central RegulaOne tenant
//   admin can do that, so WasteSync can never widen its own access.
//
// SOURCES TO RE-CONFIRM BEFORE ANY CHANGE TO THE SUBMIT / THRESHOLD RULES
//   - Ustawa o odpadach (the Waste Act) — the annual waste report filed through
//     the BDO register, and how long records must be kept
//   - Ustawa o gospodarce opakowaniami i odpadami opakowaniowymi (packaging waste)
//   - The official BDO portal: bdo.mos.gov.pl, and the statute text on
//     isap.sejm.gov.pl / gov.pl
//   Confirm the current wording at those official sources — never from a blog or
//   a summary article — before changing who may submit or set a limit.

const config = require('./environment');

// ── Layer 2: the single actions a person can be allowed to do ────────────────
// Keep these small and specific. One capability = one kind of action.
const CAPABILITIES = {
  // See the summary dashboard (counts, totals, charts, compliance alerts).
  DASHBOARD_READ: 'DASHBOARD_READ',

  // See the companies we report waste for (name, BDO number, NIP, address).
  COMPANY_READ: 'COMPANY_READ',
  // Create or change a company record, including its BDO number.
  COMPANY_WRITE: 'COMPANY_WRITE',

  // See the recorded monthly waste figures and their version history.
  WASTE_ENTRY_READ: 'WASTE_ENTRY_READ',
  // Record a month, or correct one (which saves a new version).
  WASTE_ENTRY_WRITE: 'WASTE_ENTRY_WRITE',

  // See the list of annual reports and one report's figures.
  REPORT_READ: 'REPORT_READ',
  // Build a new annual report (creates the XML + PDF files).
  REPORT_GENERATE: 'REPORT_GENERATE',
  // Download the generated XML / PDF file itself.
  REPORT_EXPORT: 'REPORT_EXPORT',
  // Mark a report as filed in the government BDO register. This is the company's
  // own record of a legal filing, so it is kept separate from generating.
  REPORT_SUBMIT: 'REPORT_SUBMIT',

  // See the legal limits reports are checked against.
  THRESHOLD_READ: 'THRESHOLD_READ',
  // Set or remove a legal limit. Held apart from recording waste on purpose.
  THRESHOLD_WRITE: 'THRESHOLD_WRITE',

  // Read the audit trail (who did what, and when).
  AUDIT_READ: 'AUDIT_READ',
};

const C = CAPABILITIES;

// ── Layer 1 → Layer 2: which job title gets which actions ────────────────────
// This table IS the access policy. Read it top to bottom to answer
// "what may this person do?".
const ROLE_CAPABILITIES = {
  // Full control of the module, including the two admin-only powers:
  // confirming a BDO filing and setting the legal limits.
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

  // Day-to-day reporting work: keep the company details right, record and correct
  // the monthly waste figures, and produce the annual report + its XML/PDF.
  // NOT allowed: confirming the BDO filing (REPORT_SUBMIT), changing the legal
  // limits (THRESHOLD_WRITE), and reading the audit trail (AUDIT_READ).
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

  // Read-only oversight. Sees every figure, every report and the full audit
  // trail, and may download the XML/PDF as evidence — but writes nothing, so the
  // person checking the numbers is never the person producing them.
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
 * The WasteSync job titles this deployment recognises.
 *
 * Normally this is every role in the table above. An environment may narrow the
 * list with WASTESYNC_ALLOWED_PERMISSIONS (see config/environment.js) — useful
 * while the platform is still rolling a new role out. A name that is not in the
 * table is ignored even if the environment lists it, because we would not know
 * what that person is allowed to do.
 */
const ROLES_WITH_ACCESS = (() => {
  const known = Object.keys(ROLE_CAPABILITIES);
  const configured = normalizePermissions(config.wastesync.allowedPermissions);

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
      `[PERMISSIONS] Ignoring unknown role name(s) in WASTESYNC_ALLOWED_PERMISSIONS: ${ignored.join(', ')}. ` +
        `Known WasteSync roles are: ${known.join(', ')}.`
    );
  }

  // Nothing usable was configured. Every request will now be refused, which is
  // the safe outcome, but it is almost certainly a mistake — so shout about it.
  if (recognised.length === 0) {
    console.error(
      '[PERMISSIONS] WASTESYNC_ALLOWED_PERMISSIONS matched no known WasteSync role. ' +
        'Every WasteSync API request will be refused until this is fixed.'
    );
  }

  return recognised;
})();

// Shorter alias for the same list, so route files can read either name.
const ALLOWED_PERMISSIONS = ROLES_WITH_ACCESS;

/**
 * Does this user hold at least one recognised WasteSync role?
 *
 * This is only the front door ("may you use WasteSync at all?"). What the person
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
 * We look at each WasteSync role they hold and collect the capabilities of all of
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
 * @param {string} capability the action being attempted, e.g. REPORT_SUBMIT
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
