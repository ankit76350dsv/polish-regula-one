// Role-based access control for PrivacyPilot.
//
// One permission matrix, used in THREE places so it cannot drift:
//   1. route guards in App.jsx           (can the role open the page at all?)
//   2. action checks inside pages        (is the button rendered/enabled?)
//   3. the mock services                 (server-side simulation — actions are
//                                         rejected even if the UI is bypassed)
//
// This fixes the biggest RBAC failure of both prototypes: a matrix that was
// rendered as a pretty table but never actually enforced anywhere.

export const ROLES = {
  TENANT_ADMIN: 'TENANT_ADMIN',
  COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER',
  DPO: 'DPO',
  AUDITOR: 'AUDITOR',
  EMPLOYEE: 'EMPLOYEE',
};

export const ROLE_LABELS = {
  TENANT_ADMIN:       { en: 'Company Admin',      pl: 'Administrator firmy' },
  COMPLIANCE_OFFICER: { en: 'Compliance Officer', pl: 'Specjalista ds. zgodności' },
  DPO:                { en: 'DPO (IOD)',          pl: 'Inspektor Ochrony Danych (IOD)' },
  AUDITOR:            { en: 'Auditor',            pl: 'Audytor' },
  EMPLOYEE:           { en: 'Employee',           pl: 'Pracownik' },
};

// Actions — named after what they do, checked with can(role, ACTIONS.X).
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

// Least-privilege matrix. Auditors are strictly read + export (they must never
// be able to modify the evidence they audit). Employees only see their tasks.
const MATRIX = {
  TENANT_ADMIN: [
    A.VIEW_REGISTER, A.CREATE_ACTIVITY, A.EDIT_ACTIVITY, A.DELETE_ACTIVITY, A.APPROVE_ACTIVITY,
    A.MANAGE_DPIA, A.SIGN_DPIA, A.MANAGE_VENDORS, A.MANAGE_TRANSFERS, A.MANAGE_BREACHES,
    A.MANAGE_DSAR, A.GENERATE_NOTICES, A.EXPORT_DATA, A.VIEW_AUDIT_TRAIL, A.MANAGE_USERS, A.EDIT_SETTINGS,
  ],
  COMPLIANCE_OFFICER: [
    A.VIEW_REGISTER, A.CREATE_ACTIVITY, A.EDIT_ACTIVITY, A.MANAGE_DPIA,
    A.MANAGE_VENDORS, A.MANAGE_TRANSFERS, A.MANAGE_BREACHES, A.MANAGE_DSAR,
    A.GENERATE_NOTICES, A.EXPORT_DATA, A.VIEW_AUDIT_TRAIL,
  ],
  DPO: [
    A.VIEW_REGISTER, A.MANAGE_DPIA, A.SIGN_DPIA, A.APPROVE_ACTIVITY,
    A.MANAGE_BREACHES, A.MANAGE_DSAR, A.EXPORT_DATA, A.VIEW_AUDIT_TRAIL,
  ],
  AUDITOR: [
    A.VIEW_REGISTER, A.EXPORT_DATA, A.VIEW_AUDIT_TRAIL,
  ],
  EMPLOYEE: [],
};

/** Central permission check. Everything RBAC goes through this one function. */
export function can(role, action) {
  return MATRIX[role]?.includes(action) ?? false;
}

/** Which sidebar sections a role sees. Used by DashboardLayout. */
export function navForRole(role) {
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
  return items.filter((i) => i.always || can(role, i.action) || (i.or && can(role, i.or)));
}
