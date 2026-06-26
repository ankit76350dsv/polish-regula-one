/**
 * Audit service — read-only access to the immutable activity log.
 * Delegates to the mock backend now; swap to the real API by flipping USE_MOCK.
 */
import { USE_MOCK } from "../config";
import mockApi from "../mock/mockApi";
import { api } from "./api";

export const auditService = {
  list() {
    if (USE_MOCK) return mockApi.listAudit();
    return api.get("/api/safevoice/audit");
  },
};

export default auditService;
