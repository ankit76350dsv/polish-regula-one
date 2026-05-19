// React Query hooks for the License Tiers page.
//
// Hooks exported:
//   useTierStats()           — GET /api/superadmin/packages/tier-stats
//   useRecentTierChanges()   — GET /api/superadmin/tier-changes?limit=4
//   useAllTierChanges()      — GET /api/superadmin/tier-changes  (full history)
//   useExportBilling()       — GET /api/superadmin/tier-changes/export → CSV download

import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { packageService } from '../services/packageService';

export const TIER_KEYS = {
  stats:         ['tiers', 'stats'],
  recentChanges: ['tiers', 'changes', 'recent'],
  allChanges:    ['tiers', 'changes', 'all'],
};

// Fetches MRR summary + per-tier data for the stats cards and package cards.
export function useTierStats() {
  return useQuery({
    queryKey: TIER_KEYS.stats,
    queryFn:  () => packageService.getTierStats(),
  });
}

// Fetches the 4 most recent tier-change events for the summary table.
export function useRecentTierChanges() {
  return useQuery({
    queryKey: TIER_KEYS.recentChanges,
    queryFn:  () => packageService.getTierChanges(4),
  });
}

// Fetches the complete tier-change history (used by the "Full History" modal/view).
export function useAllTierChanges() {
  return useQuery({
    queryKey: TIER_KEYS.allChanges,
    queryFn:  () => packageService.getTierChanges(0),
    // Not fetched until explicitly enabled — avoids an extra call on mount.
    enabled:  false,
  });
}

// Triggers a CSV billing export and saves the file in the browser.
// Implemented as a mutation (not a query) because it has a side-effect
// (creates a download) and should not run automatically on mount.
export function useExportBilling() {
  return useMutation({
    mutationFn: async () => {
      const csv = await packageService.exportBillingCsv();
      // Create a Blob and trigger a browser download without navigating away
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = `billing-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Billing report downloaded'),
    onError:   (err) => toast.error(err.message ?? 'Export failed'),
  });
}
