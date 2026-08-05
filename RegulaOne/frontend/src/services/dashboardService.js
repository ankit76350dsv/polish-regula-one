import { api } from '../lib/api';

/**
 * Network calls for the two compliance dashboards.
 *
 * There is ONE call per screen. The server gathers the figures from all six
 * compliance modules and works out every legal deadline itself, so the browser
 * never has to add numbers up or compute a due date — two screens can never
 * disagree that way.
 *
 * Note there is no company id and no user id in either URL. The backend takes both
 * from the signed-in session, so nobody can ask for another company's figures — or
 * a colleague's — by editing the address bar. The /company/:tenantId/... id in the
 * browser address is only there to make the URL readable.
 */
export const dashboardService = {
  // GET /api/admin/overview  →  CompanyOverviewResponse
  // The whole COMPANY's compliance position. ROLE_ADMIN only.
  getCompanyOverview: () => api.get('/api/admin/overview'),

  // GET /api/me/overview  →  MyOverviewResponse
  // What the SIGNED-IN PERSON has to do. Open to every signed-in role, because it
  // answers only for the caller's own records.
  getMyOverview: () => api.get('/api/me/overview'),
};
