/**
 * SafeVoice permission model — the single source of truth for "what may this user do?".
 *
 * SIMPLE EXPLANATION:
 * RegulaOne's /me endpoint returns a `permissions` array. The entries that start
 * with "SAFEVOICE_" are this module's roles, e.g. SAFEVOICE_COMPLIANCE_OFFICER.
 * A user can hold several. Each SAFEVOICE_* role grants a set of capabilities
 * (view, assign, close, export, audits, manage users, manage retention). We OR
 * together the capabilities of every SAFEVOICE_* role the user holds.
 *
 * The whole app asks `can(user, "exportData")` etc. through this file, so access
 * rules live in ONE place and the UI never has to parse permission strings itself.
 *
 * IMPORTANT: these client-side checks are for UX only (hiding/disabling controls).
 * The backend MUST re-check every permission server-side — a frontend check can
 * always be bypassed.
 */

// Prefix that marks a SafeVoice-scoped permission in the /me permissions array.
export const SAFEVOICE_PREFIX = "SAFEVOICE_";

// The capabilities the UI gates on.
export const CAPABILITIES = [
  "viewReports",
  "updateCaseProgress", // change a case's status & severity (NOT assignment)
  "assignCases",
  "closeCases",
  "exportData",
  "accessAudits",
  "manageUsers",
  "manageRetention",
];

// What each SAFEVOICE_* role is allowed to do. Mirrors the RegulaOne role design.
export const SAFEVOICE_ROLE_PERMISSIONS = {
  SAFEVOICE_ADMIN: {
    viewReports: true, updateCaseProgress: true, assignCases: true, closeCases: true, exportData: true,
    accessAudits: true, manageUsers: true, manageRetention: true,
  },
  SAFEVOICE_COMPLIANCE_OFFICER: {
    viewReports: true, updateCaseProgress: true, assignCases: true, closeCases: true, exportData: false,
    accessAudits: true, manageUsers: false, manageRetention: true,
  },
  SAFEVOICE_INVESTIGATOR: {
    // Investigators may progress a case they work (status & severity) but may NOT
    // route it (assignment) or close it — those stay with admins/compliance officers.
    viewReports: true, updateCaseProgress: true, assignCases: false, closeCases: false, exportData: false,
    accessAudits: false, manageUsers: false, manageRetention: false,
  },
  SAFEVOICE_HR_MANAGER: {
    viewReports: true, updateCaseProgress: false, assignCases: false, closeCases: false, exportData: false,
    accessAudits: false, manageUsers: false, manageRetention: false,
  },
  SAFEVOICE_AUDITOR: {
    viewReports: true, updateCaseProgress: false, assignCases: false, closeCases: false, exportData: true,
    accessAudits: true, manageUsers: false, manageRetention: false,
  },
};

// Highest-privilege first — used to pick a single role label to display.
const ROLE_PRIORITY = [
  "SAFEVOICE_ADMIN",
  "SAFEVOICE_COMPLIANCE_OFFICER",
  "SAFEVOICE_AUDITOR",
  "SAFEVOICE_INVESTIGATOR",
  "SAFEVOICE_HR_MANAGER",
];

// All SAFEVOICE_* permission codes the user holds.
export function safeVoiceRoles(user) {
  return (user?.permissions || []).filter((p) => p.startsWith(SAFEVOICE_PREFIX) && SAFEVOICE_ROLE_PERMISSIONS[p]);
}

// The one role code to show in the UI (the most privileged the user holds), or null.
export function primarySafeVoiceRole(permissions = []) {
  const held = permissions.filter((p) => SAFEVOICE_ROLE_PERMISSIONS[p]);
  return ROLE_PRIORITY.find((r) => held.includes(r)) || held[0] || null;
}

// The merged capability map for a user. Platform super admins get everything.
export function capabilitiesFor(user) {
  const caps = Object.fromEntries(CAPABILITIES.map((c) => [c, false]));
  const isSuperAdmin = user?.role === "ROLE_SUPER_ADMIN";

  for (const role of safeVoiceRoles(user)) {
    const grant = SAFEVOICE_ROLE_PERMISSIONS[role];
    for (const c of CAPABILITIES) if (grant[c]) caps[c] = true;
  }
  if (isSuperAdmin) for (const c of CAPABILITIES) caps[c] = true;

  // Derived: who may open the Compliance settings area.
  caps.manageSettings = caps.manageRetention || caps.manageUsers;
  return caps;
}

// Does the user have a single capability?
export function can(user, capability) {
  return Boolean(capabilitiesFor(user)[capability]);
}

// Which capability a staff route/page requires (null = any signed-in staff).
export const PAGE_CAPABILITY = {
  "/dashboard": "viewReports",
  "/cases": "viewReports",
  "/messages": "viewReports",
  "/audits": "accessAudits",
  "/users": "manageUsers",
  "/settings": "manageSettings",
};

export function requiredCapabilityForPath(path) {
  if (path.startsWith("/cases/")) return "viewReports";
  return PAGE_CAPABILITY[path] ?? null;
}

// The permission matrix rows shown on the Access controls page.
export const ROLE_PERMISSION_ROWS = Object.entries(SAFEVOICE_ROLE_PERMISSIONS).map(
  ([role, perms]) => ({ role, ...perms }),
);

// Normalise a raw RegulaOne /me payload into the user shape the app relies on.
// Used by the auth service to map the /api/auth/me response into our user shape.
export function normalizeUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  const permissions = Array.isArray(raw.permissions) ? raw.permissions : [];
  return {
    name: raw.name ?? "",
    email: raw.email ?? "",
    role: raw.role ?? "", // raw platform role, e.g. ROLE_ADMIN / ROLE_SUPER_ADMIN
    permissions,
    safeVoiceRole: primarySafeVoiceRole(permissions), // for display
    tenantId: raw.tenantId ?? "",
    tenantName: raw.tenantName ?? null,
    enabled: raw.enabled,
    moduleIds: Array.isArray(raw.moduleIds) ? raw.moduleIds : [],
    planExpired: Boolean(raw.planExpired),
    planExpiresAt: raw.planExpiresAt ?? null,
  };
}
