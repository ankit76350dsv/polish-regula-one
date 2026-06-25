// React Query hooks for Team Management pages.
// Separates data-fetching concerns from UI components.
//
// ROLE_ADMIN (org-scoped) hooks:
//   useTeamStats()               — GET /api/admin/team-management/{tenantId}
//   useTeamMembers()             — GET /api/admin/users/{tenantId}
//   useInviteUser()              — POST /api/admin/users/invite
//   useUpdateUserStatus()        — PATCH /api/admin/users/{userId}/status
//
// ROLE_SUPER_ADMIN (platform-wide) hooks:
//   useSuperAdminStats()         — GET /api/superadmin/team-management
//   useSuperAdminUsers()         — GET /api/superadmin/list-all-users
//   useUpdateSuperAdminUserStatus() — PATCH /api/admin/users/{userId}/status

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';
import { userService } from '../services/userService';

// Stable query key factories — used to invalidate related queries after mutations.
export const TEAM_KEYS = {
  stats:   (tenantId) => ['team', 'stats',   tenantId],
  members: (tenantId) => ['team', 'members', tenantId],
};

// Superadmin query keys — platform-wide scope, no tenantId needed.
export const SUPERADMIN_KEYS = {
  stats: ['superadmin', 'stats'],
  users: ['superadmin', 'users'],
};

// Fetches seat usage, member counts, and plan info for the stats cards.
// Disabled until a tenantId is available in the auth store.
export function useTeamStats() {
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  return useQuery({
    queryKey: TEAM_KEYS.stats(tenantId),
    queryFn:  () => userService.getTeamManagementStats(tenantId),
    enabled:  !!tenantId,
  });
}

// Fetches the full list of users for the tenant's users table.
// Disabled until a tenantId is available in the auth store.
export function useTeamMembers() {
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  return useQuery({
    queryKey: TEAM_KEYS.members(tenantId),
    queryFn:  () => userService.getAllUsers(tenantId),
    enabled:  !!tenantId,
  });
}

// Sends an invite to a new user and refreshes both members and stats on success.
// The tenantId from the auth store is merged into the payload here — callers
// only need to pass { name, email, role }.
export function useInviteUser() {
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: (data) => userService.inviteUser({ ...data, tenantId }),
    onSuccess: (_, variables) => {
      toast.success(`Invitation sent to ${variables.email}`);
      qc.invalidateQueries({ queryKey: TEAM_KEYS.members(tenantId) });
      qc.invalidateQueries({ queryKey: TEAM_KEYS.stats(tenantId) });
    },
    onError: (err) => toast.error(err.message ?? 'Failed to send invitation'),
  });
}

// Replaces a user's module access list and refreshes the members list on success.
// Caller passes { userId, moduleIds }.
export function useUpdateUserModules() {
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, moduleIds }) => userService.updateUserModules(userId, moduleIds),
    onSuccess: () => {
      toast.success('Module access updated');
      qc.invalidateQueries({ queryKey: TEAM_KEYS.members(tenantId) });
    },
    onError: (err) => toast.error(err.message ?? 'Failed to update module access'),
  });
}

// Replaces a user's cross-app permission codes and refreshes the members list.
// Caller passes { userId, permissions } — permissions is an array of strings
// such as ['KSEF_AUDITOR', 'KSEF_CASE_MANAGER'].
export function useUpdateUserPermissions() {
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, permissions }) => userService.updateUserPermissions(userId, permissions),
    onSuccess: () => {
      toast.success('Permissions updated');
      qc.invalidateQueries({ queryKey: TEAM_KEYS.members(tenantId) });
    },
    onError: (err) => toast.error(err.message ?? 'Failed to update permissions'),
  });
}

// Enables or disables a user and refreshes both members and stats on success.
// Caller passes { userId, enabled } — where enabled: true = ACTIVE, false = SUSPENDED.
export function useUpdateUserStatus() {
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, enabled }) =>
      userService.updateUserStatus(userId, { enabled }),
    onSuccess: (_, { enabled }) => {
      toast.success(enabled ? 'User reactivated successfully' : 'User suspended successfully');
      qc.invalidateQueries({ queryKey: TEAM_KEYS.members(tenantId) });
      qc.invalidateQueries({ queryKey: TEAM_KEYS.stats(tenantId) });
    },
    onError: (err) => toast.error(err.message ?? 'Failed to update user status'),
  });
}

// ── Superadmin hooks ──────────────────────────────────────────────────────────

// Fetches users for a specific tenant — used by superadmin's TenantDetailPage.
// tenantId comes from the URL param (useParams), not the auth store, because
// a superadmin has no tenantId of their own.
export function useTenantUsers(tenantId) {
  return useQuery({
    queryKey: ['superadmin', 'tenant-users', tenantId],
    queryFn:  () => userService.getTenantUsers(tenantId),
    enabled:  !!tenantId,
  });
}



// Fetches platform-wide stats (all tenants aggregated).
// Always enabled — superadmin has no tenantId constraint.
export function useSuperAdminStats() {
  return useQuery({
    queryKey: SUPERADMIN_KEYS.stats,
    queryFn:  () => userService.getSuperAdminStats(),
  });
}

// Fetches every user across all tenants for the platform users table.
// Accepts { enabled } so callers that are not super-admin can switch the query off and avoid a
// pointless 403 against the superadmin namespace (defaults to enabled for existing callers).
export function useSuperAdminUsers({ enabled = true } = {}) {
  return useQuery({
    queryKey: SUPERADMIN_KEYS.users,
    queryFn:  () => userService.getAllUsersGlobal(),
    enabled,
  });
}

// Enables or disables any user from the superadmin context.
// Uses /api/superadmin/users/{userId}/status — the /api/admin/** namespace rejects
// ROLE_SUPER_ADMIN with 403 because that route requires ROLE_ADMIN.
// Invalidates superadmin query keys so the platform-wide table and stats refresh.
export function useUpdateSuperAdminUserStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, enabled }) =>
      userService.updateUserStatusSuperAdmin(userId, { enabled }),
    onSuccess: (_, { enabled }) => {
      toast.success(enabled ? 'User reactivated successfully' : 'User suspended successfully');
      qc.invalidateQueries({ queryKey: SUPERADMIN_KEYS.users });
      qc.invalidateQueries({ queryKey: SUPERADMIN_KEYS.stats });
    },
    onError: (err) => toast.error(err.message ?? 'Failed to update user status'),
  });
}

// Replaces a user's cross-app permission codes from the superadmin context.
// Uses /api/superadmin/users/{userId}/permissions — the only path allowed to grant the
// platform-level KSEF_PLATFORM_ADMIN code. Invalidates the platform-wide users list.
export function useUpdateSuperAdminUserPermissions() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, permissions }) =>
      userService.updateUserPermissionsSuperAdmin(userId, permissions),
    onSuccess: () => {
      toast.success('Permissions updated');
      qc.invalidateQueries({ queryKey: SUPERADMIN_KEYS.users });
    },
    onError: (err) => toast.error(err.message ?? 'Failed to update permissions'),
  });
}
