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

  getById: (id) =>
    api.get(`/api/tenant/${id}`),

  create: (data) =>
    api.post('/api/superadmin/tenant', data),

  update: (id, data) =>
    api.put(`/api/superadmin/tenant/${id}`, data),

  delete: (id) =>
    api.del(`/api/superadmin/tenant/${id}`),

  changeStatus: (id, status) =>
    api.patch(`/api/superadmin/tenant/${id}/status`, { status }),

  // Called by ROLE_ADMIN on first login when tenantId is null.
  // Creates the org and links it to the current admin's account in one step.
  setupOrg: (data) =>
    api.post('/api/admin/org/setup', data),
};
