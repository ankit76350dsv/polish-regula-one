/**
 * Dashboard service — the headline numbers for the staff dashboard's stat cards.
 * Staff-only, so it goes through `staffApi` (which carries the identity headers).
 */
import { staffApi } from "./api";

export const dashboardService = {
  // { openReports, unreadReplies, slaCompliancePercent, auditEntries }
  getStats() {
    return staffApi.get("/api/v1/internal/dashboard/stats");
  },
};

export default dashboardService;
