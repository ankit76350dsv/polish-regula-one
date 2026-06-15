// React Query hooks for the Profile page.
//
// useMyProfile()       — GET /api/auth/me  (shared query key ['me'] with the store)
// useUpdateMyProfile() — PATCH /api/auth/me  (any role: updates own name)
// useMyOrg()          — GET /api/tenant/info  (admin + user: view own company info)
// useUpdateMyOrg()    — PUT /api/admin/org  (admin only: edit company info)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authService } from '../services/authService';
import { tenantService } from '../services/tenantService';
import { useAuthStore, mapApiUserToProfile } from '../store/authStore';

// Fetches the current user's full profile from /me.
// Uses the same ['me'] query key as the auth store so any cache update is shared.
export function useMyProfile() {
  return useQuery({
    queryKey:  ['me'],
    queryFn:   authService.getMe,
    staleTime: 60_000,
  });
}

// Lets any authenticated user update their own display name.
// On success: updates the ['me'] cache and refreshes the auth store's displayName
// so the sidebar/avatar reflect the change immediately without a page reload.
export function useUpdateMyProfile() {
  const qc      = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const user    = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (data) => authService.updateMe(data),
    onSuccess: (updated) => {
      toast.success('Profile updated successfully');
      // Refresh the ['me'] cache so the profile page re-renders
      qc.setQueryData(['me'], updated);
      // Keep the Zustand auth store in sync so the sidebar name updates instantly
      if (user) setUser({ ...user, displayName: updated.name });
    },
    onError: (err) => toast.error(err.message ?? 'Failed to update profile'),
  });
}

// Fetches the company/tenant details for the current user.
// Uses tenantId from the auth store — works for both ROLE_ADMIN and ROLE_USER.
// Returns null immediately for ROLE_SUPER_ADMIN (no tenant).
export function useMyOrg() {
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  return useQuery({
    queryKey: ['org', tenantId],
    queryFn:  () => tenantService.getMyTenant(),
    enabled:  !!tenantId,
  });
}

// Lets ROLE_ADMIN update their own organisation's contact/address details.
// On success: refreshes the ['org', tenantId] cache so the profile page updates.
export function useUpdateMyOrg() {
  const qc       = useQueryClient();
  const tenantId = useAuthStore((s) => s.user?.tenantId);

  return useMutation({
    mutationFn: (data) => tenantService.updateMyOrg(data),
    onSuccess: (updated) => {
      toast.success('Company information updated');
      qc.setQueryData(['org', tenantId], updated);
    },
    onError: (err) => toast.error(err.message ?? 'Failed to update company info'),
  });
}
