// SafeWork module access rules.
//
// After a user logs in through the central RegulaOne SSO, the /api/auth/me
// response tells us two important things about what this user is allowed to do:
//
//   1. moduleIds   -> the list of apps their tenant has bought a licence for
//                     (for example: ["KSEFFLOW", "WORKPULSE", "SAFEWORK", ...]).
//   2. planExpired -> true when their subscription plan has run out.
//
// This file keeps the SafeWork-specific rule in ONE place so we never have to
// hard-code the string "SAFEWORK" all over the app. If we ever rename the
// module we only change it here.

import { SAFEWORK_ROLES } from "./capabilities";

// The module id for THIS app. The /me response must contain this value inside
// its moduleIds list for the user to be allowed in.
export const MODULE_ID = "SAFEWORK";

// The job titles that are allowed to use SafeWork.
//
// The /me response also contains a "permissions" list, for example:
//   ["KSEF_ADMIN", "SAFEWORK_ADMIN", "SAFEWORK_AUDITOR", ...]
// That list covers every app on the platform. A person may open SafeWork only if
// their list contains at least ONE SafeWork job title.
//
// We read the names straight from config/capabilities.js instead of typing them
// again here, so there is only ONE list of SafeWork roles in the frontend. What
// each role may then DO also lives in that file.
//
// IMPORTANT: this is only about showing the right screen. The REAL gate is the
// backend (safeWork/backend/src/config/permissions.js), which refuses every API
// call from a user without the matching permission. A hidden page is never
// security on its own — the server always decides.
export const SAFEWORK_PERMISSIONS = SAFEWORK_ROLES;

// The possible answers when we check a user's access.
// We use plain strings (not numbers) so logs and debugging are easy to read.
export const ACCESS = {
  ALLOWED: "ALLOWED", // user may use SafeWork
  MODULE_UNAVAILABLE: "MODULE_UNAVAILABLE", // tenant has no SafeWork licence
  PLAN_EXPIRED: "PLAN_EXPIRED", // subscription plan has expired
  PERMISSION_DENIED: "PERMISSION_DENIED", // tenant has SafeWork, this user was not given it
  PAGE_NOT_PERMITTED: "PAGE_NOT_PERMITTED", // user may use SafeWork, but not this page
};

// Look at the logged-in user object and decide what they are allowed to do.
//
// Order of the checks matters:
//   1. First we make sure SafeWork is even part of their package. If the module
//      is missing there is nothing they can do here except contact an admin, so
//      we return MODULE_UNAVAILABLE straight away.
//   2. Only if they DO own the module do we then care about whether the plan is
//      still paid for. An expired plan is something they can fix by renewing.
//
// `user` is the object returned by getMe(). We stay defensive because a broken
// or partial response should never accidentally grant access.
export const getModuleAccess = (user) => {
  // No user at all -> treat as no licence. (ProtectedRoute should already stop
  // this case, but we double-check so the function is safe on its own.)
  if (!user) {
    return ACCESS.MODULE_UNAVAILABLE;
  }

  // moduleIds should be an array. If it is missing or the wrong type, treat it
  // as an empty list so we fail safely (deny access) instead of crashing.
  const moduleIds = Array.isArray(user.moduleIds) ? user.moduleIds : [];

  // Check the licence first. We compare in a case-insensitive way just in case
  // the backend ever sends "SafeWork" instead of "SAFEWORK".
  const hasModule = moduleIds.some(
    (id) => String(id).toUpperCase() === MODULE_ID
  );

  if (!hasModule) {
    return ACCESS.MODULE_UNAVAILABLE;
  }

  // They own the module — now check whether the plan is still active.
  if (user.planExpired === true) {
    return ACCESS.PLAN_EXPIRED;
  }

  // Last check: the company owns SafeWork and has paid for it, but was THIS
  // person actually given SafeWork? We answer that with the permission list.
  //
  // We check this AFTER the licence and plan checks on purpose: "your company
  // never bought this app" and "your plan ran out" are different problems with
  // different fixes, and the user should see the most useful message first.
  //
  // If the list is missing or is not an array we treat it as empty, so a broken
  // response denies access instead of granting it.
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  const hasSafeWorkPermission = permissions.some((permission) =>
    SAFEWORK_PERMISSIONS.includes(String(permission).toUpperCase())
  );

  if (!hasSafeWorkPermission) {
    return ACCESS.PERMISSION_DENIED;
  }

  // Owns the module, plan is active, and this user was granted SafeWork.
  return ACCESS.ALLOWED;
};
