// Central place that decides whether a signed-in user may enter the SafeVoice staff area.
//
// SafeVoice is the "SAFEVOICE" module of the RegulaOne platform. A user may enter when:
//   1. their account is enabled,
//   2. their plan includes the SAFEVOICE module,
//   3. their subscription has not expired, AND
//   4. they hold at least one SAFEVOICE_* permission (role).
// Platform super admins (ROLE_SUPER_ADMIN) bypass the module/plan/permission checks.
//
// This gate is for STAFF only — the public report/track pages are never passed through it.
import { safeVoiceRoles } from "./permissions";

// The module key as it appears in /me.moduleIds (matches the backend TenantModule enum).
export const SAFEVOICE_MODULE = "SAFEVOICE";

/**
 * Decide SafeVoice staff access from the /me user object.
 *
 * @returns {{ allowed: boolean, reason: 'unauthenticated'|'disabled'|'module'|'package'|'permission'|null }}
 *   'permission' — has the module but no SAFEVOICE_* role, so nothing is authorised.
 */
export function evaluateSafeVoiceAccess(user) {
  if (!user) return { allowed: false, reason: "unauthenticated" };

  // Disabled accounts are blocked outright — checked before everything else.
  if (user.enabled === false) return { allowed: false, reason: "disabled" };

  // Platform operator sees every module and has no tenant plan.
  if (user.role === "ROLE_SUPER_ADMIN") return { allowed: true, reason: null };

  const modules = Array.isArray(user.moduleIds) ? user.moduleIds : [];
  if (!modules.includes(SAFEVOICE_MODULE)) return { allowed: false, reason: "module" };

  if (user.planExpired) return { allowed: false, reason: "package" };

  // Must hold at least one SAFEVOICE_* permission to do anything in the module.
  if (safeVoiceRoles(user).length === 0) return { allowed: false, reason: "permission" };

  return { allowed: true, reason: null };
}
