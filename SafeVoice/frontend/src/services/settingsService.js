/**
 * Settings & compliance service — retention/review settings and GDPR data-subject
 * requests. Delegates to the mock backend now; swap to the real API via USE_MOCK.
 */
import { USE_MOCK } from "../config";
import mockApi from "../mock/mockApi";
import { api } from "./api";

export const settingsService = {
  get() {
    if (USE_MOCK) return mockApi.getSettings();
    return api.get("/api/safevoice/settings");
  },
  submitDataRequest(payload) {
    if (USE_MOCK) return mockApi.submitDataRequest(payload);
    return api.post("/api/safevoice/data-requests", payload);
  },
};

export default settingsService;
