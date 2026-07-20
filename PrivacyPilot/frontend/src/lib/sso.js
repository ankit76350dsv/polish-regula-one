// Consumes the RegulaOne single-sign-on identity (/api/auth/me) for PrivacyPilot.
//
// The /me payload has TWO distinct authorization fields — keep them separate:
//   • role        → the PLATFORM role, a SINGLE string, one of
//                   ROLE_ADMIN | ROLE_USER | ROLE_SUPER_ADMIN.
//   • permissions → an ARRAY of module permission codes across every app the user
//                   can use, e.g. ["KSEF_ADMIN", "PRIVACYPILOT_ADMIN", ...].
//
// PrivacyPilot reads the PRIVACYPILOT_* entries of `permissions` for RBAC (see
// lib/permissions.js). We do NOT rename or remap those codes — PRIVACYPILOT_ADMIN
// stays PRIVACYPILOT_ADMIN everywhere.

// The prefix that marks a PrivacyPilot permission in the /me permissions array.
export const PRIVACYPILOT_PREFIX = 'PRIVACYPILOT_';

// The module key as it appears in /me.moduleIds (matches the backend TenantModule enum).
export const PRIVACYPILOT_MODULE = 'PRIVACYPILOT';

// Most-privileged first — used only to pick ONE code to show/attribute when a user
// holds several. These are real permission codes, not a separate role concept.
const PP_PRIORITY = [
  'PRIVACYPILOT_ADMIN',
  'PRIVACYPILOT_COMPLIANCE_OFFICER',
  'PRIVACYPILOT_DPO',
  'PRIVACYPILOT_AUDITOR',
  'PRIVACYPILOT_EMPLOYEE',
];

// Just the PrivacyPilot permission codes a user holds (other apps' codes dropped).
export function privacyPilotPermissions(user) {
  return (user?.permissions || []).filter((p) => p.startsWith(PRIVACYPILOT_PREFIX));
}

// ── Display helpers ────────────────────────────────────────────────────────────
// Show a permission code with underscores as spaces (e.g. "PRIVACYPILOT_ADMIN" →
// "PRIVACYPILOT ADMIN"). We show the REAL code, not a friendly business name.
export function formatPermissionCode(code) {
  return code ? code.replace(/_/g, ' ') : code;
}

// Friendly names for the platform role (the single ROLE_* value from /me).
const PLATFORM_ROLE_LABELS = {
  ROLE_SUPER_ADMIN: 'Super Admin',
  ROLE_ADMIN: 'Admin',
  ROLE_USER: 'User',
};

export function platformRoleLabel(role) {
  if (!role) return '';
  return PLATFORM_ROLE_LABELS[role] ?? role.replace(/^ROLE_/, '').replace(/_/g, ' ');
}

// The single line to show as a user's "role" in the UI: their most-privileged
// PrivacyPilot code (as the raw code), or the platform role if they hold none.
export function roleDisplay(user) {
  if (!user) return '';
  return user.primaryPermission
    ? formatPermissionCode(user.primaryPermission)
    : platformRoleLabel(user.role);
}

// The single most-privileged PrivacyPilot code a user holds, or null. For the
// "acting as" label and audit attribution only — it is a real PRIVACYPILOT_* code.
export function primaryPermission(permissions = []) {
  return PP_PRIORITY.find((code) => permissions.includes(code)) ?? null;
}

/**
 * Turn a raw RegulaOne /me payload into the user object PrivacyPilot relies on.
 * Fields are kept faithful to the API: `role` is the platform role string,
 * `permissions` is the full cross-app code array. `primaryPermission` is a derived
 * convenience (a real PRIVACYPILOT_* code, or null) used only for display/audit.
 */
export function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const permissions = Array.isArray(raw.permissions) ? raw.permissions : [];
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    email: raw.email ?? '',
    role: raw.role ?? '', // PLATFORM role: ROLE_ADMIN | ROLE_USER | ROLE_SUPER_ADMIN
    permissions, // ARRAY of ALL module permission codes
    primaryPermission: primaryPermission(permissions), // most-privileged PRIVACYPILOT_* code, or null
    tenantId: raw.tenantId ?? '',
    tenantName: raw.tenantName ?? null,
    tenantStatus: raw.tenantStatus ?? null,
    enabled: raw.enabled,
    moduleIds: Array.isArray(raw.moduleIds) ? raw.moduleIds : [],
    planExpired: Boolean(raw.planExpired),
    planExpiresAt: raw.planExpiresAt ?? null,
  };
}

/**
 * Decide whether a signed-in user may enter PrivacyPilot.
 *
 * Allowed when: the account is enabled, the plan includes the PRIVACYPILOT module,
 * the subscription has not expired, AND they hold at least one PRIVACYPILOT_*
 * permission. Platform super-admins (ROLE_SUPER_ADMIN) bypass the module/plan/
 * permission checks.
 *
 * @returns {{ allowed: boolean, reason: 'unauthenticated'|'disabled'|'module'|'package'|'permission'|null }}
 */
export function evaluatePrivacyPilotAccess(user) {
  if (!user) return { allowed: false, reason: 'unauthenticated' };
  if (user.enabled === false) return { allowed: false, reason: 'disabled' };
  if (user.role === 'ROLE_SUPER_ADMIN') return { allowed: true, reason: null };

  if (!user.moduleIds.includes(PRIVACYPILOT_MODULE)) return { allowed: false, reason: 'module' };
  if (user.planExpired) return { allowed: false, reason: 'package' };
  if (privacyPilotPermissions(user).length === 0) return { allowed: false, reason: 'permission' };

  return { allowed: true, reason: null };
}
