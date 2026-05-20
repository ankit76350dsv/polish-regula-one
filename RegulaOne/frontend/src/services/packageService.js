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

  // POST /api/superadmin/packages
  // Body: { name, description?, price, currency, durationType, duration,
  //         usersCapacity?, appIds[], status? }
  // Returns PackageResponse for the newly created package (201 Created).
  createPackage: (data) =>
    api.post('/api/superadmin/packages', data),

  // DELETE /api/superadmin/packages/{id}
  // Nullifies currentPackage on any tenant assigned to this package before
  // removing the catalogue entry — prevents stale @DBRef errors. Returns 204.
  // api.del (not api.delete — "delete" is a reserved JS keyword so the helper uses "del")
  deletePackage: (id) =>
    api.del(`/api/superadmin/packages/${id}`),

  // GET /api/superadmin/packages  (existing endpoint — paginated catalogue list)
  getAllPackages: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)),
    ).toString();
    return api.get(`/api/superadmin/packages${qs ? `?${qs}` : ''}`);
  },

  // GET /api/admin/packages
  // Returns all ACTIVE packages sorted by price ascending.
  // Used by ROLE_ADMIN on the My Plan page to compare available tiers.
  getAdminPackages: () =>
    api.get('/api/admin/packages'),

  // GET /api/admin/billing
  // Returns the authenticated admin's tenant invoice history, newest first.
  // Each entry: { invoiceNumber, packageName, amount, currency, period, createdAt, status }
  getAdminBilling: () =>
    api.get('/api/admin/billing'),
};
