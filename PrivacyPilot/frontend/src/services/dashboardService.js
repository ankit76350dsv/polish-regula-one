// Compliance dashboard summary — one read from the real PrivacyPilot backend
// (DashboardController: GET /api/privacypilot/dashboard). The server does all the
// counting and the legal-clock maths (72h breach window, DSAR due dates) so the page
// just paints the numbers.
import { get } from './client';

const BASE = '/api/privacypilot/dashboard';

export const dashboardService = {
  /** The dashboard summary for the signed-in company. */
  get: () => get(BASE),
};
