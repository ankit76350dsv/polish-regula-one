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

import { ROLE_LABELS } from './permissions';

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
// The stored permission code with its underscores swapped for spaces
// ("PRIVACYPILOT_ADMIN" → "PRIVACYPILOT ADMIN").
//
// This is a LAST RESORT only: a safety net in case the ranked list below (PP_PRIORITY) and
// the wording list (ROLE_LABELS in lib/permissions.js) ever fall out of step, so a user
// still sees something rather than a blank space. The names people should actually see
// live in ROLE_LABELS.
//
// No longer exported: it used to be the profile and sidebar's normal way of naming a
// permission, which is why those screens read "PRIVACYPILOT ADMIN" while the Users screen
// said "PrivacyPilot Admin" for the same person. Keeping it private stops a future screen
// from reintroducing that.
function formatPermissionCode(code) {
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

/**
 * The single line to show as a user's role in the UI: the friendly name of their
 * most-privileged PrivacyPilot permission, or the account role if they hold none.
 *
 * This used to return the raw code, so the sidebar under every screen read
 * "PRIVACYPILOT ADMIN" while the Users and Profile screens said "PrivacyPilot Admin"
 * for the same person.
 *
 * @param {object} user the signed-in user
 * @param {'pl'|'en'} lang which wording to use
 */
export function roleDisplay(user, lang = 'en') {
  if (!user) return '';
  if (!user.primaryPermission) return platformRoleLabel(user.role);
  return ROLE_LABELS[user.primaryPermission]?.[lang] ?? formatPermissionCode(user.primaryPermission);
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
    // Fail closed if the identity response omits or changes the enabled flag.
    enabled: raw.enabled === true,
    moduleIds: Array.isArray(raw.moduleIds) ? raw.moduleIds : [],
    planExpired: Boolean(raw.planExpired),
    planExpiresAt: raw.planExpiresAt ?? null,
  };
}

/**
 * Decide whether a signed-in user may enter PrivacyPilot.
 *
 * Allowed when: the account is enabled, the organisation is active, the plan includes
 * the PRIVACYPILOT module, the subscription has not expired, AND they hold at least one
 * PRIVACYPILOT_* permission. Platform super-admins (ROLE_SUPER_ADMIN) bypass the
 * organisation/module/plan/permission checks.
 *
 * IMPORTANT: this is the FRIENDLY copy of the rule — it decides which explanation screen
 * to show. The rule that actually PROTECTS the data is the identical one on the server
 * (backend PrivacyPilotAccessPolicy.java), because anyone can skip the browser and call
 * the API directly. Keep the two in step: same checks, same order, same meaning.
 *
 * @returns {{ allowed: boolean, reason: 'unauthenticated'|'disabled'|'organisation'|'module'|'package'|'permission'|null }}
 */
export function evaluatePrivacyPilotAccess(user) {
  if (!user) return { allowed: false, reason: 'unauthenticated' };
  if (user.enabled !== true) return { allowed: false, reason: 'disabled' };
  if (user.role === 'ROLE_SUPER_ADMIN') return { allowed: true, reason: null };

  // A suspended or closed organisation may not use the app. We only block on a status we
  // were actually told — an older organisation record may not carry the field yet, and
  // refusing on "unknown" would lock out companies that are in fact fine.
  if (user.tenantStatus && user.tenantStatus.toUpperCase() !== 'ACTIVE') {
    return { allowed: false, reason: 'organisation' };
  }
  if (user.planExpired) return { allowed: false, reason: 'package' };
  if (!user.moduleIds.includes(PRIVACYPILOT_MODULE)) return { allowed: false, reason: 'module' };
  if (privacyPilotPermissions(user).length === 0) return { allowed: false, reason: 'permission' };

  return { allowed: true, reason: null };
}
