// Maps the RegulaOne single-sign-on identity onto PrivacyPilot's own role model.
//
// SIMPLE EXPLANATION:
// RegulaOne's /api/auth/me returns a `permissions` array holding codes for EVERY
// app the user can use (KSEF_*, SAFEVOICE_*, PRIVACYPILOT_*). This file keeps only
// the PRIVACYPILOT_* codes and turns the most privileged one into the single role
// name the rest of PrivacyPilot already understands (TENANT_ADMIN, DPO, ...), so
// the existing RBAC matrix (lib/permissions.js) keeps working unchanged.

import { ROLES } from './permissions';

// The prefix that marks a PrivacyPilot permission in the /me permissions array.
export const PRIVACYPILOT_PREFIX = 'PRIVACYPILOT_';

// The module key as it appears in /me.moduleIds (matches the backend TenantModule enum).
export const PRIVACYPILOT_MODULE = 'PRIVACYPILOT';

// Which backend permission code grants which in-app role.
const PERMISSION_TO_ROLE = {
  PRIVACYPILOT_ADMIN: ROLES.TENANT_ADMIN,
  PRIVACYPILOT_COMPLIANCE_OFFICER: ROLES.COMPLIANCE_OFFICER,
  PRIVACYPILOT_DPO: ROLES.DPO,
  PRIVACYPILOT_AUDITOR: ROLES.AUDITOR,
  PRIVACYPILOT_EMPLOYEE: ROLES.EMPLOYEE,
};

// Most-privileged first — used to pick ONE role when a user holds several.
const ROLE_PRIORITY = [
  ROLES.TENANT_ADMIN,
  ROLES.COMPLIANCE_OFFICER,
  ROLES.DPO,
  ROLES.AUDITOR,
  ROLES.EMPLOYEE,
];

// The single in-app role for a user, derived from their PrivacyPilot permissions.
// Returns null if they hold no PrivacyPilot permission at all.
export function primaryRole(permissions = []) {
  const held = permissions.map((code) => PERMISSION_TO_ROLE[code]).filter(Boolean);
  return ROLE_PRIORITY.find((r) => held.includes(r)) ?? null;
}

/**
 * Turn a raw RegulaOne /me payload into the user object PrivacyPilot relies on.
 *
 * The important field is `role`: a single in-app role name, so `can(user.role, …)`
 * and the mock data layer (which reads `{ name, role }` as the actor) keep working.
 * A platform super-admin with no PrivacyPilot permission is treated as a full admin.
 */
export function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const permissions = Array.isArray(raw.permissions) ? raw.permissions : [];
  const platformRole = raw.role ?? '';
  let role = primaryRole(permissions);
  // A platform operator sees everything even without a module permission.
  if (!role && platformRole === 'ROLE_SUPER_ADMIN') role = ROLES.TENANT_ADMIN;

  return {
    name: raw.name ?? '',
    email: raw.email ?? '',
    role, // the single in-app role used everywhere for RBAC + audit attribution
    platformRole, // raw RegulaOne role, e.g. ROLE_ADMIN / ROLE_SUPER_ADMIN
    permissions, // full cross-app permission list, kept for reference
    tenantId: raw.tenantId ?? '',
    tenantName: raw.tenantName ?? null,
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
 * the subscription has not expired, AND they hold at least one PRIVACYPILOT_* role.
 * Platform super-admins bypass the module/plan/permission checks.
 *
 * @returns {{ allowed: boolean, reason: 'unauthenticated'|'disabled'|'module'|'package'|'permission'|null }}
 */
export function evaluatePrivacyPilotAccess(user) {
  if (!user) return { allowed: false, reason: 'unauthenticated' };
  if (user.enabled === false) return { allowed: false, reason: 'disabled' };
  if (user.platformRole === 'ROLE_SUPER_ADMIN') return { allowed: true, reason: null };

  if (!user.moduleIds.includes(PRIVACYPILOT_MODULE)) return { allowed: false, reason: 'module' };
  if (user.planExpired) return { allowed: false, reason: 'package' };
  if (!user.role) return { allowed: false, reason: 'permission' };

  return { allowed: true, reason: null };
}
