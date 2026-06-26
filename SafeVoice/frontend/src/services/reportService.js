/**
 * Report service — the ONLY place report API calls are defined.
 *
 * SIMPLE EXPLANATION:
 * Each function checks one switch (USE_MOCK). While we build the UI it calls the
 * fake backend (mockApi). When the real backend is ready, set VITE_USE_MOCK=false
 * and these functions call the real RegulaOne API instead — no component changes.
 * The real endpoints below are written but only run in non-mock mode.
 */
import { USE_MOCK } from "../config";
import mockApi from "../mock/mockApi";
import { api } from "./api";

export const reportService = {
  // Public: submit a new anonymous report.
  createReport(payload) {
    if (USE_MOCK) return mockApi.createReport(payload);
    return api.post("/api/safevoice/reports", payload);
  },

  // Public: look up a case using ONLY the access key (the single credential).
  trackReport(accessKey) {
    if (USE_MOCK) return mockApi.trackReport(accessKey);
    return api.post("/api/safevoice/reports/track", { accessKey });
  },

  // Staff: list all cases for the signed-in tenant.
  listReports() {
    if (USE_MOCK) return mockApi.listReports();
    return api.get("/api/safevoice/reports");
  },

  // Staff: load one case by id.
  getReport(id) {
    if (USE_MOCK) return mockApi.getReport(id);
    return api.get(`/api/safevoice/reports/${encodeURIComponent(id)}`);
  },

  // Staff: update one field (status / severity / assignedInvestigator).
  updateReport(id, patch) {
    if (USE_MOCK) return mockApi.updateReport(id, patch);
    return api.patch(`/api/safevoice/reports/${encodeURIComponent(id)}`, patch);
  },
};

export default reportService;
