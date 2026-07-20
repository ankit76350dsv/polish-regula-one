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
  PRIVACYPILOT_ADMIN:              { en: 'Company Admin',      pl: 'Administrator firmy' },
  PRIVACYPILOT_COMPLIANCE_OFFICER: { en: 'Compliance Officer', pl: 'Specjalista ds. zgodności' },
  PRIVACYPILOT_DPO:                { en: 'DPO (IOD)',          pl: 'Inspektor Ochrony Danych (IOD)' },
  PRIVACYPILOT_AUDITOR:            { en: 'Auditor',            pl: 'Audytor' },
  PRIVACYPILOT_EMPLOYEE:           { en: 'Employee',           pl: 'Pracownik' },
};

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

/** Which sidebar sections a user sees. Used by DashboardLayout. */
export function navFor(user) {
  const items = [
    { to: '/dashboard',  key: 'nav.dashboard',  always: true },
    { to: '/register',   key: 'nav.register',   action: A.VIEW_REGISTER },
    { to: '/dpia',       key: 'nav.dpia',       action: A.MANAGE_DPIA, or: A.VIEW_REGISTER },
    { to: '/notices',    key: 'nav.notices',    action: A.GENERATE_NOTICES },
    { to: '/vendors',    key: 'nav.vendors',    action: A.MANAGE_VENDORS },
    { to: '/transfers',  key: 'nav.transfers',  action: A.MANAGE_TRANSFERS },
    { to: '/breaches',   key: 'nav.breaches',   action: A.MANAGE_BREACHES },
    { to: '/dsar',       key: 'nav.dsar',       action: A.MANAGE_DSAR },
    { to: '/audit-trail', key: 'nav.auditTrail', action: A.VIEW_AUDIT_TRAIL },
    { to: '/users',      key: 'nav.users',      action: A.MANAGE_USERS },
    { to: '/settings',   key: 'nav.settings',   action: A.EDIT_SETTINGS },
  ];
  return items.filter((i) => i.always || can(user, i.action) || (i.or && can(user, i.or)));
}
