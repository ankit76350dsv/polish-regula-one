import { api } from '../lib/api';

/**
 * Network calls for the company-admin compliance dashboard.
 *
 * There is ONE call. The server gathers the figures from all six compliance
 * modules and works out every legal deadline itself, so the browser never has to
 * add numbers up or compute a due date — two screens can never disagree that way.
 *
 * Note there is no company id in the URL. The backend takes the company from the
 * signed-in session, so a user cannot ask for another company's figures by editing
 * the address bar. The /company/:tenantId/... id in the browser address is only
 * there to make the URL readable.
 */
export const dashboardService = {
  // GET /api/admin/overview  →  CompanyOverviewResponse
  getCompanyOverview: () => api.get('/api/admin/overview'),
};
