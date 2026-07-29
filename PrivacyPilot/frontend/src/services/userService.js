// Users and access are owned by RegulaOne, the platform identity service.
// PrivacyPilot reads the caller's tenant-scoped team and sends account mutations
// directly to the existing RegulaOne admin API using the shared SSO cookie.
import { apiRequest } from './client';
import { REGULAONE_API_BASE } from './http';
import { PRIVACYPILOT_MODULE, PRIVACYPILOT_PREFIX, primaryPermission } from '../lib/sso';

const regulaOneRequest = (path, options = {}) =>
  apiRequest(path, { ...options, baseUrl: REGULAONE_API_BASE });

function toPersonnel(user) {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const moduleIds = Array.isArray(user?.moduleIds) ? user.moduleIds : [];
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: primaryPermission(permissions) ?? '',
    accountRole: user.role,
    permissions,
    privacyPermissions: permissions.filter(
      (permission) => permission.startsWith(PRIVACYPILOT_PREFIX),
    ),
    moduleIds,
    hasAccess: moduleIds.includes(PRIVACYPILOT_MODULE),
    active: user.enabled !== false,
  };
}

function byAccessThenName(a, b) {
  if (a.hasAccess !== b.hasAccess) return a.hasAccess ? -1 : 1;
  return (a.name || '').localeCompare(b.name || '');
}

export const userService = {
  async list() {
    const users = await regulaOneRequest('/api/tenant/users');
    return Array.isArray(users) ? users.map(toPersonnel).sort(byAccessThenName) : [];
  },

  async invite(actor, { name, email, permissions, role }) {
    if (!actor?.tenantId) throw new Error('TENANT_REQUIRED');
    const created = await regulaOneRequest('/api/admin/users/invite', {
      method: 'POST',
      body: {
        name,
        email,
        role: role || 'ROLE_USER',
        tenantId: actor.tenantId,
        moduleIds: [PRIVACYPILOT_MODULE],
        permissions: Array.isArray(permissions) ? permissions : [],
      },
    });
    return toPersonnel(created);
  },

  // RegulaOne replaces the entire cross-app permission list. Preserve every code
  // owned by other modules and replace only this user's PrivacyPilot role.
  async changeRole(user, role) {
    if (!user) throw new Error('NOT_FOUND');
    const otherPermissions = (user.permissions ?? [])
      .filter((permission) => !permission.startsWith(PRIVACYPILOT_PREFIX));
    const permissions = role ? [...otherPermissions, role] : otherPermissions;
    const updated = await regulaOneRequest(
      `/api/admin/users/${encodeURIComponent(user.id)}/permissions`,
      { method: 'PATCH', body: { permissions } },
    );
    return toPersonnel(updated);
  },

  async setActive(id, active) {
    const updated = await regulaOneRequest(
      `/api/admin/users/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: { enabled: active } },
    );
    return toPersonnel(updated);
  },

  // User accounts are owned by RegulaOne. This permanently removes the account
  // there (including Cognito), so access to every module is revoked at once.
  remove(id) {
    return regulaOneRequest(
      `/api/admin/users/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },
};
