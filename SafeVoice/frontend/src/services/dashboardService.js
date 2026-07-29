/**
 * Dashboard service — the headline numbers for the staff dashboard's stat cards.
 * Staff-only, so it goes through `staffApi` (which carries the identity headers).
 */
import { staffApi } from "./api";
import { normalizeReports } from "./caseNormalizer";

export const dashboardService = {
  // { openReports, unreadReplies, slaCompliancePercent, auditEntries }
  getStats() {
    return staffApi.get("/api/v1/internal/dashboard/stats");
  },

  // The "cases needing attention" queue: active cases with no investigator assigned.
  // Returns slim case summaries (normalised), newest first.
  async getAttention(limit = 20) {
    const list = await staffApi.get(`/api/v1/internal/dashboard/attention?limit=${limit}`);
    return normalizeReports(list);
  },
};

export default dashboardService;
