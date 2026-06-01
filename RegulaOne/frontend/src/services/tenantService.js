import { api } from '../lib/api';

export const tenantService = {
  getAll: ({ search, status, page = 0, size = 10, sortBy = 'createdAt', sortDir = 'desc' } = {}) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('size', String(size));
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    return api.get(`/api/superadmin/tenants?${params.toString()}`);
  },

  // GET /api/tenant/info
  // Returns the current user's own tenant. The backend derives the tenant id from
  // the authenticated JWT, so no id is sent from the client (tenant isolation).
  getMyTenant: () =>
    api.get('/api/tenant/info'),

  create: (data) =>
    api.post('/api/superadmin/tenant', data),

  update: (id, data) =>
    api.put(`/api/superadmin/tenant/${id}`, data),

  delete: (id) =>
    api.del(`/api/superadmin/tenant/${id}`),

  changeStatus: (id, status) =>
    api.patch(`/api/superadmin/tenant/${id}/status`, { status }),

  // GET /api/superadmin/overview
  // Returns PlatformOverviewResponse: stat card values, 6-month revenue chart,
  // and per-module adoption percentages for the SuperAdmin Platform Overview page.
  getPlatformOverview: () =>
    api.get('/api/superadmin/overview'),

  // Called by ROLE_ADMIN on first login when tenantId is null.
  // Creates the org and links it to the current admin's account in one step.
  setupOrg: (data) =>
    api.post('/api/admin/org/setup', data),

  // PUT /api/admin/org
  // Lets ROLE_ADMIN update their own org's contact/address details.
  // Excluded fields: nip, regon (legal IDs), status (superadmin-only).
  updateMyOrg: (data) =>
    api.put('/api/admin/org', data),
};
