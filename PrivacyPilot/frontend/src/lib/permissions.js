// Role-based access control for PrivacyPilot.
//
// The vocabulary here is the SAME set of permission codes RegulaOne grants and the
// PrivacyPilot backend enum defines (PrivacyPilotPermission): PRIVACYPILOT_ADMIN,
// PRIVACYPILOT_COMPLIANCE_OFFICER, PRIVACYPILOT_DPO, PRIVACYPILOT_AUDITOR,
// PRIVACYPILOT_EMPLOYEE. There is NO separate "internal role" name — a code is a code.
//
// IMPORTANT — two different things, never mix them up:
//   • user.role        → the PLATFORM role, a SINGLE string, one of
//                        ROLE_ADMIN | ROLE_USER | ROLE_SUPER_ADMIN. (RegulaOne-wide.)
//   • user.permissions → an ARRAY of module permission codes the user holds, e.g.
//                        ["PRIVACYPILOT_ADMIN", "PRIVACYPILOT_AUDITOR", "KSEF_ADMIN"].
// PrivacyPilot authorises on the PRIVACYPILOT_* entries of `permissions`; a user can
// hold several, so `can()` ORs the capabilities of every code they hold.
//
// One matrix, used in THREE places so it cannot drift:
//   1. route guards in App.jsx
//   2. action checks inside pages (is the button rendered/enabled?)
//   3. the mock services (rejected even if the UI is bypassed)

// The PrivacyPilot permission codes. Keyed by themselves so callers read clearly.
export const ROLES = {
  PRIVACYPILOT_ADMIN: 'PRIVACYPILOT_ADMIN',
  PRIVACYPILOT_COMPLIANCE_OFFICER: 'PRIVACYPILOT_COMPLIANCE_OFFICER',
  PRIVACYPILOT_DPO: 'PRIVACYPILOT_DPO',
  PRIVACYPILOT_AUDITOR: 'PRIVACYPILOT_AUDITOR',
  PRIVACYPILOT_EMPLOYEE: 'PRIVACYPILOT_EMPLOYEE',
};

export const ROLE_LABELS = {
  PRIVACYPILOT_ADMIN:              { en: 'PrivacyPilot Admin', pl: 'Administrator PrivacyPilot' },
  PRIVACYPILOT_COMPLIANCE_OFFICER: { en: 'Compliance Officer', pl: 'Specjalista ds. zgodności' },
  PRIVACYPILOT_DPO:                { en: 'DPO (IOD)',          pl: 'Inspektor Ochrony Danych (IOD)' },
  PRIVACYPILOT_AUDITOR:            { en: 'Auditor',            pl: 'Audytor' },
  PRIVACYPILOT_EMPLOYEE:           { en: 'Employee',           pl: 'Pracownik' },
};

/**
 * The RegulaOne ACCOUNT role, in words — a different vocabulary from the PrivacyPilot
 * permissions above, and stored in the same `actorRole` field on an audit entry.
 */
export const ACCOUNT_ROLE_LABELS = {
  ROLE_USER:        { en: 'User',        pl: 'Użytkownik' },
  ROLE_ADMIN:       { en: 'Admin',       pl: 'Administrator' },
  ROLE_SUPER_ADMIN: { en: 'Super Admin', pl: 'Superadministrator' },
};

/**
 * Any stored role code → words a non-technical reader understands.
 *
 * WHY BOTH TABLES ARE TRIED: an audit entry's `actorRole` is whichever the person had —
 * their PrivacyPilot permission if they hold one, otherwise their RegulaOne account role
 * (see services/api.js). Exported evidence must never print "PRIVACYPILOT_ADMIN" at an
 * auditor; falling back to the raw code is a last resort, not the normal path.
 */
export function roleLabel(code, lang) {
  if (!code) return '';
  return ROLE_LABELS[code]?.[lang] ?? ACCOUNT_ROLE_LABELS[code]?.[lang] ?? code;
}

// Actions — named after what they do, checked with can(user, ACTIONS.X).
export const ACTIONS = {
  VIEW_REGISTER: 'VIEW_REGISTER',
  CREATE_ACTIVITY: 'CREATE_ACTIVITY',
  EDIT_ACTIVITY: 'EDIT_ACTIVITY',
  DELETE_ACTIVITY: 'DELETE_ACTIVITY',
  APPROVE_ACTIVITY: 'APPROVE_ACTIVITY',
  MANAGE_DPIA: 'MANAGE_DPIA',
  SIGN_DPIA: 'SIGN_DPIA',
  MANAGE_VENDORS: 'MANAGE_VENDORS',
  MANAGE_TRANSFERS: 'MANAGE_TRANSFERS',
  MANAGE_BREACHES: 'MANAGE_BREACHES',
  MANAGE_DSAR: 'MANAGE_DSAR',
  GENERATE_NOTICES: 'GENERATE_NOTICES',
  EXPORT_DATA: 'EXPORT_DATA',
  VIEW_AUDIT_TRAIL: 'VIEW_AUDIT_TRAIL',
  MANAGE_USERS: 'MANAGE_USERS',
  EDIT_SETTINGS: 'EDIT_SETTINGS',
};

const A = ACTIONS;
const R = ROLES;

// The platform role that means "SaaS operator" — bypasses module permission checks.
const PLATFORM_SUPER_ADMIN = 'ROLE_SUPER_ADMIN';

// Least-privilege matrix, keyed by PrivacyPilot permission code. Auditors are
// strictly read + export (they must never modify the evidence they audit).
// Employees hold no privacy-management rights.
const MATRIX = {
  [R.PRIVACYPILOT_ADMIN]: [
    A.VIEW_REGISTER, A.CREATE_ACTIVITY, A.EDIT_ACTIVITY, A.DELETE_ACTIVITY, A.APPROVE_ACTIVITY,
    A.MANAGE_DPIA, A.SIGN_DPIA, A.MANAGE_VENDORS, A.MANAGE_TRANSFERS, A.MANAGE_BREACHES,
    A.MANAGE_DSAR, A.GENERATE_NOTICES, A.EXPORT_DATA, A.VIEW_AUDIT_TRAIL, A.MANAGE_USERS, A.EDIT_SETTINGS,
  ],
  [R.PRIVACYPILOT_COMPLIANCE_OFFICER]: [
    A.VIEW_REGISTER, A.CREATE_ACTIVITY, A.EDIT_ACTIVITY, A.MANAGE_DPIA,
    A.MANAGE_VENDORS, A.MANAGE_TRANSFERS, A.MANAGE_BREACHES, A.MANAGE_DSAR,
    A.GENERATE_NOTICES, A.EXPORT_DATA, A.VIEW_AUDIT_TRAIL,
  ],
  [R.PRIVACYPILOT_DPO]: [
    A.VIEW_REGISTER, A.MANAGE_DPIA, A.SIGN_DPIA, A.APPROVE_ACTIVITY,
    A.MANAGE_BREACHES, A.MANAGE_DSAR, A.EXPORT_DATA, A.VIEW_AUDIT_TRAIL,
  ],
  [R.PRIVACYPILOT_AUDITOR]: [
    A.VIEW_REGISTER, A.EXPORT_DATA, A.VIEW_AUDIT_TRAIL,
  ],
  [R.PRIVACYPILOT_EMPLOYEE]: [],
};

/**
 * Does a SINGLE permission code allow an action? The low-level check against the
 * matrix. Use this when you have one code in hand (e.g. rendering the matrix, or
 * checking a required signer role). For the current user, use can() instead.
 */
export function permissionCan(code, action) {
  return MATRIX[code]?.includes(action) ?? false;
}

/**
 * Can THIS USER perform an action? A user holds an array of permission codes, so we
 * allow the action if ANY PrivacyPilot code they hold permits it. Platform super
 * admins can do everything. This is the check the whole app uses.
 */
export function can(user, action) {
  if (!user) return false;
  if (user.role === PLATFORM_SUPER_ADMIN) return true;
  const codes = Array.isArray(user.permissions) ? user.permissions : [];
  return codes.some((code) => permissionCan(code, action));
}

/** Does the user hold a specific permission code? (e.g. the signer of a DPIA line.) */
export function hasRole(user, code) {
  return Array.isArray(user?.permissions) && user.permissions.includes(code);
}

// The two halves of the sidebar. `work` is the day-to-day compliance work; `admin` is
// overseeing and configuring the app. Eleven links in one undivided list are hard to scan,
// and the split matches how people think about them.
export const NAV_SECTIONS = { WORK: 'work', ADMIN: 'admin' };

/** Which sidebar sections a user sees. Used by DashboardLayout. */
export function navFor(user) {
  const S = NAV_SECTIONS;
  const items = [
    { to: '/dashboard',  key: 'nav.dashboard',  section: S.WORK,  always: true },
    { to: '/register',   key: 'nav.register',   section: S.WORK,  action: A.VIEW_REGISTER },
    { to: '/dpia',       key: 'nav.dpia',       section: S.WORK,  action: A.MANAGE_DPIA, or: A.VIEW_REGISTER },
    { to: '/notices',    key: 'nav.notices',    section: S.WORK,  action: A.GENERATE_NOTICES },
    { to: '/vendors',    key: 'nav.vendors',    section: S.WORK,  action: A.MANAGE_VENDORS },
    { to: '/transfers',  key: 'nav.transfers',  section: S.WORK,  action: A.MANAGE_TRANSFERS },
    { to: '/breaches',   key: 'nav.breaches',   section: S.WORK,  action: A.MANAGE_BREACHES },
    { to: '/dsar',       key: 'nav.dsar',       section: S.WORK,  action: A.MANAGE_DSAR },
    { to: '/audit-trail', key: 'nav.auditTrail', section: S.ADMIN, action: A.VIEW_AUDIT_TRAIL },
    { to: '/users',      key: 'nav.users',      section: S.ADMIN, action: A.MANAGE_USERS },
    { to: '/settings',   key: 'nav.settings',   section: S.ADMIN, action: A.EDIT_SETTINGS },
  ];
  return items.filter((i) => i.always || can(user, i.action) || (i.or && can(user, i.or)));
}
