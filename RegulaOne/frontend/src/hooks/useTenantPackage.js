// React Query hooks for managing a tenant's package: listing the catalogue and
// the renew / upgrade mutations wired to the superadmin package APIs.
//
//   useAllPackages()            — GET /api/superadmin/packages (full catalogue)
//   useRenewPackage(tenantId)   — POST .../tenants/{id}/package/renew
//   useUpgradePackage(tenantId) — POST .../tenants/{id}/package/upgrade
//
// On success both mutations invalidate the tenants list and tier stats so the
// Package column and the License Tiers dashboard refresh automatically.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { packageService } from '../services/packageService';
import { TIER_KEYS } from './usePackageTiers';

export const PACKAGE_KEYS = {
  all: ['packages', 'all'],
};

// Fetches the whole package catalogue (up to 100), cheapest first, so the plan
// page can show every tier with full details (price, durationType, status, apps).
export function useAllPackages() {
  return useQuery({
    queryKey: PACKAGE_KEYS.all,
    queryFn: () =>
      packageService.getAllPackages({ page: 0, size: 100, sortBy: 'price', sortDir: 'asc' }),
  });
}

// Renews the tenant's current package. Body: { reason? }.
export function useRenewPackage(tenantId, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body = {}) => packageService.renewPackage(tenantId, body),
    onSuccess: (res) => {
      toast.success(`"${res.packageName}" renewed successfully`);
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: TIER_KEYS.stats });
      options.onSuccess?.(res);
    },
    onError: (err) => toast.error(err.message ?? 'Renewal failed'),
  });
}

// Switches the tenant to a different package. Body: { packageId, reason? }.
export function useUpgradePackage(tenantId, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => packageService.upgradePackage(tenantId, body),
    onSuccess: (res) => {
      toast.success(`Plan changed to "${res.toPackage}"`);
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: TIER_KEYS.stats });
      options.onSuccess?.(res);
    },
    onError: (err) => toast.error(err.message ?? 'Plan change failed'),
  });
}
