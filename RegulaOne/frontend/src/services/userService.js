// Pure async functions that call the backend admin user-management APIs.
// No state, no side-effects — just fetch wrappers composed in useTeam.js hooks.

import { api } from '../lib/api';

export const userService = {
  // POST /api/admin/users/invite
  // Body: { name, email, role, tenantId }
  // Returns UserResponse for the newly created invited user.
  inviteUser: (data) =>
    api.post('/api/admin/users/invite', data),

  // GET /api/admin/users/{tenantId}
  // Returns List<UserResponse> — all users belonging to the tenant.
  getAllUsers: (tenantId) =>
    api.get(`/api/admin/users/${tenantId}`),

  // GET /api/admin/team-management/{tenantId}
  // Returns TeamManagementStatsResponse: totalMembers, activeMembers,
  // suspendedMembers, tierLimit, seatUsage, remainingSeats, currentPlan, tenantName.
  getTeamManagementStats: (tenantId) =>
    api.get(`/api/admin/team-management/${tenantId}`),

  // PATCH /api/admin/users/{userId}/status
  // Body: { enabled: boolean } — true = ACTIVE, false = SUSPENDED.
  // Only callable by ROLE_ADMIN (org-scoped). ROLE_SUPER_ADMIN must use
  // updateUserStatusSuperAdmin below — the /api/admin/** namespace rejects them with 403.
  updateUserStatus: (userId, data) =>
    api.patch(`/api/admin/users/${userId}/status`, data),

  // PATCH /api/superadmin/users/{userId}/status
  // Same logic as updateUserStatus but under the superadmin route namespace so
  // ROLE_SUPER_ADMIN is authorised to call it.
  updateUserStatusSuperAdmin: (userId, data) =>
    api.patch(`/api/superadmin/users/${userId}/status`, data),

  // PUT /api/admin/users/{subId}
  // Body: { name, email, role } — kept here for future use (change role flow).
  updateUser: (subId, data) =>
    api.put(`/api/admin/users/${subId}`, data),

  // DELETE /api/admin/users/{username}
  // Kept here for future delete-user flow.
  deleteUser: (username) =>
    api.del(`/api/admin/users/${username}`),

  // ── Superadmin endpoints (no tenantId — platform-wide scope) ──────────────

  // GET /api/superadmin/team-management
  // Returns TeamManagementStatsResponse with platform-wide aggregates:
  // totalMembers, activeMembers, suspendedMembers, tierLimit, seatUsage,
  // remainingSeats, currentPlan, and optionally planExpiresAt.
  getSuperAdminStats: () =>
    api.get('/api/superadmin/team-management'),

  // GET /api/superadmin/list-all-users
  // Returns List<UserResponse> — all users across every tenant.
  // Each UserResponse includes tenantId, tenantName for the superadmin table.
  getAllUsersGlobal: () =>
    api.get('/api/superadmin/list-all-users'),

  // GET /api/superadmin/tenants/{tenantId}/users
  // Returns List<UserResponse> for a single tenant — used by TenantDetailPage.
  // Mirrors /api/admin/users/{tenantId} but under superadmin namespace so
  // ROLE_SUPER_ADMIN is authorised to call it (admin namespace rejects them with 403).
  getTenantUsers: (tenantId) =>
    api.get(`/api/superadmin/tenants/${tenantId}/users`),
};
