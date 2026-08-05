import { api } from '../lib/api';

/**
 * Network calls for the three dashboards.
 *
 * There is ONE call per screen. The server gathers the figures, works out every legal
 * deadline and groups every amount by its currency itself, so the browser never has
 * to add numbers up or compute a due date — two screens can never disagree that way.
 *
 * Each screen is strictly narrower in scope than the one above it:
 *
 *   getPlatformOverview  →  "how is the business doing?"   all customers, commercial only
 *   getCompanyOverview   →  "is my company compliant?"     one company's figures
 *   getMyOverview        →  "am I in order?"               one person's records
 *
 * Note there is no company id and no user id in ANY of these URLs. The backend takes
 * both from the signed-in session, so nobody can ask for another company's figures —
 * or a colleague's — by editing the address bar. The /company/:tenantId/... id in the
 * browser address is only there to make the URL readable.
 */
export const dashboardService = {
  // GET /api/superadmin/overview  →  PlatformOverviewResponse
  // The platform's commercial position across every customer. ROLE_SUPER_ADMIN only.
  // Carries no customer module data — RegulaOne is a processor of that data, not its
  // controller. See PlatformOverviewResponse on the backend.
  getPlatformOverview: () => api.get('/api/superadmin/overview'),

  // GET /api/admin/overview  →  CompanyOverviewResponse
  // The whole COMPANY's compliance position. ROLE_ADMIN only.
  getCompanyOverview: () => api.get('/api/admin/overview'),

  // GET /api/me/overview  →  MyOverviewResponse
  // What the SIGNED-IN PERSON has to do. Open to every signed-in role, because it
  // answers only for the caller's own records.
  getMyOverview: () => api.get('/api/me/overview'),
};
