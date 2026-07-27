// WasteSync module access rules.
//
// After a user logs in through the central RegulaOne SSO, the /api/auth/me
// response tells us two important things about what this user is allowed to do:
//
//   1. moduleIds   -> the list of apps their tenant has bought a licence for
//                     (for example: ["KSEFFLOW", "WORKPULSE", "WASTESYNC", ...]).
//   2. planExpired -> true when their subscription plan has run out.
//
// This file keeps the WasteSync-specific rule in ONE place so we never have to
// hard-code the string "WASTESYNC" all over the app. If we ever rename the
// module we only change it here.

// The module id for THIS app. The /me response must contain this value inside
// its moduleIds list for the user to be allowed in.
export const MODULE_ID = "WASTESYNC";

// The three possible answers when we check a user's access.
// We use plain strings (not numbers) so logs and debugging are easy to read.
export const ACCESS = {
  ALLOWED: "ALLOWED", // user may use WasteSync
  MODULE_UNAVAILABLE: "MODULE_UNAVAILABLE", // tenant has no WasteSync licence
  PLAN_EXPIRED: "PLAN_EXPIRED", // subscription plan has expired
};

// Look at the logged-in user object and decide what they are allowed to do.
//
// Order of the checks matters:
//   1. First we make sure WasteSync is even part of their package. If the module
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

  // Owns the module and the plan is active -> full access.
  return ACCESS.ALLOWED;
};
