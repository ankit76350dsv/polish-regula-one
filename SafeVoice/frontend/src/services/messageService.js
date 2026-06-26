/**
 * Message service — secure two-way thread between staff and the anonymous reporter.
 * Delegates to the mock backend now; swap to the real API by flipping USE_MOCK_DATA.
 */
import { USE_MOCK_DATA } from "../config";
import mockApi from "../mock/mockApi";
import { api } from "./api";

export const messageService = {
  list(caseId) {
    if (USE_MOCK_DATA) return mockApi.listMessages(caseId);
    return api.get(`/api/safevoice/reports/${encodeURIComponent(caseId)}/messages`);
  },
  send(caseId, message) {
    if (USE_MOCK_DATA) return mockApi.sendMessage(caseId, message);
    return api.post(`/api/safevoice/reports/${encodeURIComponent(caseId)}/messages`, message);
  },
};

export default messageService;
