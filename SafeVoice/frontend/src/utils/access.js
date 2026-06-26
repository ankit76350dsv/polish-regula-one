// Central place that decides whether a signed-in user may use the SafeVoice staff area.
//
// SafeVoice is the "SAFEVOICE" whistleblower module of the RegulaOne platform. A user
// may only enter the staff area when their RegulaOne profile (the /api/auth/me response)
// grants that module AND their subscription plan is not expired. Keeping this in one pure
// function means the route guard and any future check all use the SAME rule — no drift.
//
// NOTE: this gate is for STAFF only. The public report-submission and report-tracking
// pages stay open to anonymous whistleblowers and are never passed through this check —
// that anonymity is a legal requirement of the EU Whistleblower Directive (2019/1937)
// and the Polish 2024 Whistleblower Protection Act.

// The module key as it appears in /me.moduleIds (matches the backend TenantModule enum).
export const SAFEVOICE_MODULE = "SAFEVOICE";

/**
 * Decide SafeVoice staff access from the /me user object.
 *
 * @param {object|null} user  the mapped current user ({ role, moduleIds, planExpired, enabled, … })
 * @returns {{ allowed: boolean, reason: 'unauthenticated'|'disabled'|'module'|'package'|null }}
 *
 * Reasons:
 *   'unauthenticated' — no user (not signed in)
 *   'disabled'        — the user's account is disabled (enabled: false in /me)
 *   'module'          — signed in, but the SafeVoice module is not in their plan
 *   'package'         — has the module, but the subscription/package has expired
 *   null              — access granted
 *
 * Order matters: a disabled account is blocked first (nothing else can fix it). Super Admin
 * (the platform operator) then bypasses module/package checks, mirroring RegulaOne where
 * ROLE_SUPER_ADMIN sees every module and has no tenant plan.
 */
export function evaluateSafeVoiceAccess(user) {
  if (!user) return { allowed: false, reason: "unauthenticated" };

  // Disabled accounts are blocked outright — checked before everything else.
  if (user.enabled === false) return { allowed: false, reason: "disabled" };

  if (user.role === "Super Admin") return { allowed: true, reason: null };

  const modules = Array.isArray(user.moduleIds) ? user.moduleIds : [];
  if (!modules.includes(SAFEVOICE_MODULE)) return { allowed: false, reason: "module" };

  if (user.planExpired) return { allowed: false, reason: "package" };

  return { allowed: true, reason: null };
}
