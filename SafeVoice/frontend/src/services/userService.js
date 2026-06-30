/**
 * User & permission service for the "Users and permissions" page.
 *
 * The authorised-staff LIST comes from RegulaOne (the identity service), not the
 * SafeVoice backend: RegulaOne owns the user accounts. We ask it for ALL users of the
 * caller's own organisation (GET /api/tenant/users) — the tenant is taken from the
 * session on the server, so we only ever see our own organisation. That call goes
 * through `api`, which targets the RegulaOne backend and uses the shared SSO cookie.
 *
 * Each user carries its enabled modules, so we flag who actually has SafeVoice access
 * and sort those to the top; the page styles them as the "has access" theme and dims
 * the rest. The role permission MATRIX is not fetched — it is fixed, app-side knowledge
 * of what each SAFEVOICE_* role may do, built from utils/permissions.js.
 */
import { api } from "./api";
import { getCurrentActor } from "./identity";
import { formatDate } from "./caseNormalizer";
import { SAFEVOICE_ROLE_PERMISSIONS, primarySafeVoiceRole } from "../utils/permissions";

// The compliance module this app represents (matches RegulaOne's TenantModule enum).
const SAFEVOICE_MODULE = "SAFEVOICE";

// The permission matrix rows: one per SAFEVOICE_* role with its capability flags.
// Built once from the shared role→capability map so the table can never drift from
// what the app actually enforces.
const ROLE_MATRIX = Object.entries(SAFEVOICE_ROLE_PERMISSIONS).map(([role, caps]) => ({
  role,
  ...caps,
}));

// Turn one RegulaOne user record into the shape the personnel table expects.
function toPersonnel(user) {
  const permissions = user.permissions || [];
  const modules = user.moduleIds || [];
  // Does this teammate actually have SafeVoice access? (the module is enabled for them)
  const hasAccess = modules.includes(SAFEVOICE_MODULE);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    hasAccess,
    // The SafeVoice display role is the highest SAFEVOICE_* role the user holds; only
    // users with access have one, so others fall back to their platform role.
    role: primarySafeVoiceRole(permissions) || user.role,
    status: user.enabled ? "Active" : "Disabled",
    // RegulaOne enforces MFA at the identity layer for every account, so we show it as
    // required. (There is no per-user MFA flag on this response to vary it.)
    mfaRequired: true,
    // Best-available "last review" signal: when the account was last changed.
    lastLoginReview: formatDate(user.updatedAt || user.createdAt) || "—",
  };
}

// Order: teammates WITH SafeVoice access first, then everyone else, each group by name.
function byAccessThenName(a, b) {
  if (a.hasAccess !== b.hasAccess) return a.hasAccess ? -1 : 1;
  return (a.name || "").localeCompare(b.name || "");
}

export const userService = {
  // Returns { users, rolePermissions } — the shape the users page/slice expects.
  async list() {
    const raw = await api.get("/api/tenant/users");
    const users = Array.isArray(raw) ? raw.map(toPersonnel).sort(byAccessThenName) : [];
    return { users, rolePermissions: ROLE_MATRIX };
  },

  // Invite a new SafeVoice user. Inviting is a RegulaOne (identity) admin action, so we
  // build the RegulaOne invite payload here:
  //   - moduleIds is fixed to [SAFEVOICE] — an invite from SafeVoice always grants this app.
  //   - permissions is the list of SAFEVOICE_* codes ticked on the form (what they may do
  //     in SafeVoice). Optional — an invite with none simply grants the module but no role.
  //   - role is the platform account role, defaulting to ROLE_USER.
  //   - tenantId is the inviter's own organisation (from the session), never typed in.
  // Returns the new user already mapped to the personnel-row shape.
  async invite({ name, email, permissions, role }) {
    const created = await api.post("/api/admin/users/invite", {
      name,
      email,
      role: role || "ROLE_USER",
      tenantId: getCurrentActor().tenantId,
      moduleIds: [SAFEVOICE_MODULE],
      permissions: Array.isArray(permissions) ? permissions : [],
    });
    return toPersonnel(created);
  },
  remove(id) {
    return api.del(`/api/admin/users/${encodeURIComponent(id)}`);
  },
};

export default userService;
