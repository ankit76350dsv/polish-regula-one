// Central place that decides whether a signed-in user may use the KSeFFlow app.
//
// KSeFFlow is the "KSEFFLOW" compliance module of the RegulaOne platform. A user may only enter
// when their RegulaOne profile (the /api/auth/me response) grants that module AND their plan is
// not expired. Keeping this in one pure function means the route guard, and any future check,
// all use the SAME rule — no drift.

// The module key as it appears in /me.moduleIds (matches the backend TenantModule enum).
export const KSEFFLOW_MODULE = 'KSEFFLOW';

/**
 * Decide KSeFFlow access from the /me user object.
 *
 * @param {object|null} user  the mapped current user ({ role, moduleIds, planExpired, … })
 * @returns {{ allowed: boolean, reason: 'unauthenticated'|'module'|'package'|null }}
 *
 * Reasons:
 *   'unauthenticated' — no user (not logged in)
 *   'disabled'        — the user's account is disabled (enabled: false in /me)
 *   'module'          — logged in, but the KSeFFlow module is not in their plan
 *   'package'         — has the module, but the subscription/package has expired
 *   null              — access granted
 *
 * Order matters: a disabled account is blocked first (nothing else can fix it). Super Admin
 * (the platform operator) then bypasses module/package checks, mirroring RegulaOne where
 * ROLE_SUPER_ADMIN sees every module and has no tenant plan.
 */
export function evaluateKsefAccess(user) {
  if (!user) return { allowed: false, reason: 'unauthenticated' };

  // Disabled accounts are blocked outright — checked before everything else (even Super Admin).
  if (user.enabled === false) return { allowed: false, reason: 'disabled' };

  if (user.role === 'Super Admin') return { allowed: true, reason: null };

  const modules = Array.isArray(user.moduleIds) ? user.moduleIds : [];
  if (!modules.includes(KSEFFLOW_MODULE)) return { allowed: false, reason: 'module' };

  if (user.planExpired) return { allowed: false, reason: 'package' };

  return { allowed: true, reason: null };
}
