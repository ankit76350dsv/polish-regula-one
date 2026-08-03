// WasteSync module access rules.
//
// After a user logs in through the central RegulaOne SSO, the /api/auth/me
// response tells us the things we need to know about what this user may do:
//
//   1. enabled     -> false when an administrator has switched the account off.
//   2. moduleIds   -> the list of apps their tenant has bought a licence for
//                     (for example: ["KSEFFLOW", "WORKPULSE", "WASTESYNC", ...]).
//   3. planExpired -> true when their subscription plan has run out.
//   4. permissions -> the job titles this person was given, across every app
//                     (for example: ["KSEF_ADMIN", "WASTESYNC_AUDITOR", ...]).
//
// This file keeps the WasteSync-specific rule in ONE place so we never have to
// hard-code the string "WASTESYNC" all over the app. If we ever rename the
// module we only change it here.

import { WASTESYNC_ROLES } from "./capabilities";

// The module id for THIS app. The /me response must contain this value inside
// its moduleIds list for the user to be allowed in.
export const MODULE_ID = "WASTESYNC";

// The job titles that are allowed to use WasteSync.
//
// The /me response also contains a "permissions" list, for example:
//   ["KSEF_ADMIN", "WASTESYNC_ADMIN", "WASTESYNC_AUDITOR", ...]
// That list covers every app on the platform. A person may open WasteSync only if
// their list contains at least ONE WasteSync job title.
//
// We read the names straight from config/capabilities.js instead of typing them
// again here, so there is only ONE list of WasteSync roles in the frontend. What
// each role may then DO also lives in that file.
//
// IMPORTANT: this is only about showing the right screen. The REAL gate is the
// backend (WasteSync/backend/src/config/permissions.js), which refuses every API
// call from a user without the matching permission. A hidden page is never
// security on its own — the server always decides.
export const WASTESYNC_PERMISSIONS = WASTESYNC_ROLES;

// The possible answers when we check a user's access.
// We use plain strings (not numbers) so logs and debugging are easy to read.
export const ACCESS = {
  ALLOWED: "ALLOWED", // user may use WasteSync
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED", // the account itself has been switched off
  MODULE_UNAVAILABLE: "MODULE_UNAVAILABLE", // tenant has no WasteSync licence
  PLAN_EXPIRED: "PLAN_EXPIRED", // subscription plan has expired
  PERMISSION_DENIED: "PERMISSION_DENIED", // tenant has WasteSync, this user was not given it
  PAGE_NOT_PERMITTED: "PAGE_NOT_PERMITTED", // user may use WasteSync, but not this page
};

// Look at the logged-in user object and decide what they are allowed to do.
//
// Order of the checks matters. We answer the most basic question first, because
// the user should see the message that actually explains their situation:
//   1. Is the ACCOUNT switched on at all? A suspended account cannot do anything,
//      no matter what licence or role it has, so this comes first.
//   2. Is WasteSync part of their package? If not, all they can do is ask an
//      administrator to add it.
//   3. Is the plan still paid for? An expired plan is fixed by renewing.
//   4. Was THIS person given WasteSync? (their permission list)
//
// `user` is the object returned by getMe(). We stay defensive because a broken
// or partial response should never accidentally grant access.
export const getModuleAccess = (user) => {
  // No user at all -> treat as no licence. (ProtectedRoute should already stop
  // this case, but we double-check so the function is safe on its own.)
  if (!user) {
    return ACCESS.MODULE_UNAVAILABLE;
  }

  // An administrator can suspend a person's account. When that happens the /me
  // response comes back with "enabled": false, and that person must not be able
  // to use WasteSync at all — not the dashboard, not the waste figures, nothing.
  //
  // We only treat it as suspended when the answer EXPLICITLY says false (the
  // boolean false, or the text "false" which some clients send). If the field is
  // missing we leave the account alone, because guessing "suspended" from a
  // missing field would lock out everybody the day the field gets renamed.
  //
  // The backend refuses these requests as well (see authMiddleware.js), so this
  // check is about showing a clear message instead of a page full of errors.
  const isSuspended =
    user.enabled === false || String(user.enabled).toLowerCase() === "false";

  if (isSuspended) {
    return ACCESS.ACCOUNT_SUSPENDED;
  }

  // moduleIds should be an array. If it is missing or the wrong type, treat it
  // as an empty list so we fail safely (deny access) instead of crashing.
  const moduleIds = Array.isArray(user.moduleIds) ? user.moduleIds : [];

  // Check the licence first. We compare in a case-insensitive way just in case
  // the backend ever sends "WasteSync" instead of "WASTESYNC".
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

  // Last check: the company owns WasteSync and has paid for it, but was THIS
  // person actually given WasteSync? We answer that with the permission list.
  //
  // We check this AFTER the licence and plan checks on purpose: "your company
  // never bought this app" and "your plan ran out" are different problems with
  // different fixes, and the user should see the most useful message first.
  //
  // If the list is missing or is not an array we treat it as empty, so a broken
  // response denies access instead of granting it.
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  const hasWasteSyncPermission = permissions.some((permission) =>
    WASTESYNC_PERMISSIONS.includes(String(permission).toUpperCase())
  );

  if (!hasWasteSyncPermission) {
    return ACCESS.PERMISSION_DENIED;
  }

  // Owns the module, plan is active, and this user was granted WasteSync.
  return ACCESS.ALLOWED;
};
