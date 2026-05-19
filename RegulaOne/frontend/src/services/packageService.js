// Pure async functions that call the backend package/tier management APIs.
// No state, no side-effects — composed in usePackageTiers.js hooks.

import { api } from '../lib/api';

export const packageService = {
  // GET /api/superadmin/packages/tier-stats
  // Returns PackageTierStatsResponse:
  //   totalMrr, payingTenants, mostPopularPlan, mostPopularPlanTenantCount,
  //   tiers[] → { packageId, packageName, price, currency, tenantCount, tierMrr,
  //               usersCapacity, appIds, mostPopular, status }
  getTierStats: () =>
    api.get('/api/superadmin/packages/tier-stats'),

  // GET /api/superadmin/tier-changes?limit={n}
  // Returns List<TierChangeResponse> sorted newest first.
  // Pass limit=0 or omit for full history.
  getTierChanges: (limit) => {
    const qs = limit ? `?limit=${limit}` : '';
    return api.get(`/api/superadmin/tier-changes${qs}`);
  },

  // GET /api/superadmin/tier-changes/export
  // Returns a CSV file as a plain string — the controller sets Content-Disposition.
  // Frontend triggers a browser download from the response text.
  exportBillingCsv: () =>
    api.get('/api/superadmin/tier-changes/export'),

  // GET /api/superadmin/packages  (existing endpoint — paginated catalogue list)
  getAllPackages: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)),
    ).toString();
    return api.get(`/api/superadmin/packages${qs ? `?${qs}` : ''}`);
  },
};
