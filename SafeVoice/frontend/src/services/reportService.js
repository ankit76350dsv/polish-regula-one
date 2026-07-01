/**
 * Report service — the ONLY place report API calls are defined.
 *
 * Two backends, two clients:
 *   • PUBLIC reporter calls (submit / track / post message) → `publicApi`
 *     (anonymous, no login) against the public SafeVoice endpoints.
 *   • STAFF case-management calls (list / get / status / severity / assign) →
 *     `staffApi` (carries the signed-in actor's identity headers) against the
 *     internal compliance endpoints (/api/v1/internal/cases).
 *
 * Every response is run through the case normaliser so the rest of the app always
 * receives friendly display values and short dates, never raw backend enum names.
 */
import { publicApi, staffApi } from "./api";
import {
  normalizeMessage,
  normalizeReport,
  normalizeReports,
  statusToApi,
  severityToApi,
} from "./caseNormalizer";

export const reportService = {
  // ── PUBLIC (anonymous reporter) ──────────────────────────────────────────────

  // Submit a new anonymous report. The organisation (tenantId) travels inside the
  // payload — the page reads it from the /company/{tenantId}/report URL, not from any
  // login, so a whistleblower never has to identify themselves. The response is the
  // one-time access key, so it is returned as-is (nothing to normalise).
  createReport(payload) {
    return publicApi.post("/api/safevoice/reports", payload);
  },

  // Look up a case using ONLY the access key. Returns { report, messages }; both are
  // normalised so the tracking page shows friendly statuses and dates.
  async trackReport(accessKey) {
    const data = await publicApi.post("/api/safevoice/reports/track", { accessKey });
    return {
      report: normalizeReport(data?.report),
      messages: Array.isArray(data?.messages) ? data.messages.map(normalizeMessage) : [],
    };
  },

  // The reporter posts one message (optionally with evidence files) into their own case's
  // chat thread. The endpoint is multipart: "sender" + "text" fields, plus "files" parts.
  // The case is identified by the reference they received (carried in the URL path).
  async postPublicMessage(caseId, { sender, text, files = [] }) {
    const form = new FormData();
    if (sender) form.append("sender", sender);
    form.append("text", text ?? "");
    files.forEach((file) => form.append("files", file));
    const message = await publicApi.postForm(
      `/api/safevoice/reports/${encodeURIComponent(caseId)}/messages`,
      form,
    );
    return normalizeMessage(message);
  },

  // The reporter fetches one file from their own case thread. They prove ownership with their
  // access key (sent in the body, never the URL). Returns { blob, filename } for the preview
  // modal (which also offers the download).
  fetchPublicAttachment({ accessKey, messageId, attachmentId }) {
    return publicApi.downloadFile("/api/safevoice/reports/attachments/download", {
      accessKey,
      messageId,
      attachmentId,
    });
  },

  // ── STAFF (internal compliance dashboard) ────────────────────────────────────

  // List cases for the signed-in tenant as a flat array (used by the dashboard and the
  // inbox, which want the whole set, not a page). The list endpoint is paginated, so we
  // ask for a single large page and return just the normalised rows.
  async listReports() {
    const data = await staffApi.get("/api/v1/internal/cases?page=1&size=200");
    return normalizeReports(data?.items);
  },

  // Load ONE page of the case register, with optional search and quick filter. Returns
  // the normalised rows plus the paging info (page, size, total, totalPages) the table
  // needs to draw its pager.
  async listReportsPage({ page = 1, size = 8, search = "", filter = "all" } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(size));
    if (search && search.trim()) params.set("search", search.trim());
    if (filter && filter !== "all") params.set("filter", filter);
    const data = await staffApi.get(`/api/v1/internal/cases?${params.toString()}`);
    return {
      items: normalizeReports(data?.items),
      page: data?.page ?? page,
      size: data?.size ?? size,
      total: data?.total ?? 0,
      totalPages: data?.totalPages ?? 0,
    };
  },

  // Fetch the bytes of a CASE-LEVEL attachment (a file uploaded WITH the report at
  // submission, as opposed to one on a thread message). Staff side; gated to export roles
  // server-side. Returns { blob, filename } for the preview modal.
  fetchCaseAttachment(caseId, attachmentId) {
    return staffApi.downloadFile(
      `/api/v1/internal/cases/${encodeURIComponent(caseId)}/attachments/${encodeURIComponent(
        attachmentId,
      )}`,
    );
  },

  // Load one case by its id.
  async getReport(id) {
    const report = await staffApi.get(`/api/v1/internal/cases/${encodeURIComponent(id)}`);
    return normalizeReport(report);
  },

  /**
   * Update ONE field of a case. The staff UI sends a small patch like
   * { status: "Closed" } or { assignedInvestigator: "Anna Kowalska" }; the internal
   * backend exposes a separate endpoint per field (status / severity / assign), each
   * taking its value as a query parameter. We translate the patch into the right call
   * here, converting friendly display values back into the backend's enum names.
   */
  async updateReport(id, patch) {
    const base = `/api/v1/internal/cases/${encodeURIComponent(id)}`;
    let updated;

    if ("status" in patch) {
      const value = encodeURIComponent(statusToApi(patch.status));
      updated = await staffApi.patch(`${base}/status?status=${value}`);
    } else if ("severity" in patch) {
      const value = encodeURIComponent(severityToApi(patch.severity));
      updated = await staffApi.patch(`${base}/severity?severity=${value}`);
    } else if ("assignedInvestigator" in patch) {
      const value = encodeURIComponent(patch.assignedInvestigator);
      updated = await staffApi.patch(`${base}/assign?investigator=${value}`);
    } else {
      throw new Error("Unsupported case update");
    }

    return normalizeReport(updated);
  },
};

export default reportService;
