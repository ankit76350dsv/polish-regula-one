/**
 * Report service — the ONLY place report API calls are defined.
 *
 * SIMPLE EXPLANATION:
 * Each function checks ONE switch to decide between the fake backend (mockApi) and
 * the real one. There are two switches because the two halves go live separately:
 *   • PUBLIC reporter calls (submit / track / post message) use USE_MOCK_PUBLIC and
 *     talk to the SafeVoice backend through `publicApi`. These endpoints are live now.
 *   • STAFF calls (list / get / update) use USE_MOCK_DATA and stay on mock until their
 *     backend is ready. Flip VITE_USE_MOCK_DATA="false" then — no component changes.
 */
import { USE_MOCK_DATA, USE_MOCK_PUBLIC } from "../config";
import mockApi from "../mock/mockApi";
import { api, publicApi } from "./api";

export const reportService = {
  // Public: submit a new anonymous report. The organisation (tenantId) travels inside
  // the payload — the page reads it from the /company/{tenantId}/report URL, not from
  // any login, so a whistleblower never has to identify themselves.
  createReport(payload) {
    if (USE_MOCK_PUBLIC) return mockApi.createReport(payload);
    return publicApi.post("/api/safevoice/reports", payload);
  },

  // Public: look up a case using ONLY the access key (the single credential).
  trackReport(accessKey) {
    if (USE_MOCK_PUBLIC) return mockApi.trackReport(accessKey);
    return publicApi.post("/api/safevoice/reports/track", { accessKey });
  },

  // Public: the reporter posts one message into their own case's chat thread. The case
  // is identified by the id they received from the track lookup (carried in the URL path).
  postPublicMessage(caseId, { sender, text }) {
    if (USE_MOCK_PUBLIC) return mockApi.sendMessage(caseId, { sender, text });
    return publicApi.post(`/api/safevoice/reports/${encodeURIComponent(caseId)}/messages`, {
      sender,
      text,
    });
  },

  // Staff: list all cases for the signed-in tenant.
  listReports() {
    if (USE_MOCK_DATA) return mockApi.listReports();
    return api.get("/api/safevoice/reports");
  },

  // Staff: load one case by id.
  getReport(id) {
    if (USE_MOCK_DATA) return mockApi.getReport(id);
    return api.get(`/api/safevoice/reports/${encodeURIComponent(id)}`);
  },

  // Staff: update one field (status / severity / assignedInvestigator).
  updateReport(id, patch) {
    if (USE_MOCK_DATA) return mockApi.updateReport(id, patch);
    return api.patch(`/api/safevoice/reports/${encodeURIComponent(id)}`, patch);
  },
};

export default reportService;
