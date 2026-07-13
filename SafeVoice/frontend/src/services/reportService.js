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
import { cryptoService } from "./cryptoService";
import {
  normalizeMessage,
  normalizeReport,
  normalizeReports,
  statusToApi,
  severityToApi,
} from "./caseNormalizer";

// Attach browser-locked text to a FormData as either the encrypted parts (normal, secure path)
// or a plain "text" field (dev fallback only). Shared by the reporter + staff message senders.
function appendLockedText(form, locked) {
  if (locked.encrypted) {
    form.append("ciphertext", locked.encrypted.ciphertext);
    form.append("iv", locked.encrypted.iv);
    form.append("wrappedKey", locked.encrypted.wrappedKey);
    form.append("algorithm", locked.encrypted.algorithm);
  } else {
    form.append("text", locked.plaintext);
  }
}

export const reportService = {
  // ── PUBLIC (anonymous reporter) ──────────────────────────────────────────────

  // Submit a new anonymous report. The organisation (tenantId) travels inside the payload — the
  // page reads it from the /company/{tenantId}/report URL, not from any login. The narrative
  // ("facts") is LOCKED in the browser first and sent as `encryptedContent`, so the server never
  // sees the plain words. The response is the one-time access key, returned as-is.
  async createReport(payload) {
    const { facts, tenantId, ...rest } = payload;
    const body = { tenantId, ...rest };
    if (facts && facts.trim()) {
      const locked = await cryptoService.encryptForTenant(facts, tenantId);
      if (locked.encrypted) body.encryptedContent = locked.encrypted;
      else body.facts = locked.plaintext; // dev fallback only
    }
    return publicApi.post("/api/safevoice/reports", body);
  },

  // Look up a case using ONLY the access key. Returns { report, messages }. The report narrative
  // and every message are UNLOCKED in the browser (using keys the backend unwraps via KMS), then
  // normalised so the tracking page shows friendly statuses and dates.
  async trackReport(accessKey) {
    const data = await publicApi.post("/api/safevoice/reports/track", { accessKey });
    let report = data?.report;
    let messages = Array.isArray(data?.messages) ? data.messages : [];

    // Only ask the backend to unwrap keys if something is actually encrypted (saves a KMS call
    // for plain-text/system-only cases).
    const needsKeys = report?.encryptedContent || messages.some((m) => m?.encryptedText);
    if (needsKeys) {
      ({ report, messages } = await cryptoService.decryptCaseForReporter(accessKey, report, messages));
    }
    return {
      report: normalizeReport(report),
      messages: messages.map(normalizeMessage),
    };
  },

  // The reporter posts one message (optionally with evidence files) into their own case's chat
  // thread. The text is LOCKED in the browser first (using the case's organisation id, taken from
  // the tracked report). The endpoint is multipart and AUTHENTICATED: the access key must match
  // the case id in the path. The sender label is fixed by the server.
  async postPublicMessage(caseId, { text, files = [], accessKey, tenantId }) {
    const form = new FormData();
    form.append("accessKey", accessKey ?? "");
    let plaintextEcho = "";
    if (text && text.trim()) {
      const locked = await cryptoService.encryptForTenant(text, tenantId);
      appendLockedText(form, locked);
      plaintextEcho = text; // we typed it, so show it back without a decrypt round-trip
    }
    files.forEach((file) => form.append("files", file));
    const message = await publicApi.postForm(
      `/api/safevoice/reports/${encodeURIComponent(caseId)}/messages`,
      form,
    );
    // The server stores the message encrypted and returns it with text=null; show the sender the
    // plain words they just typed.
    const normalized = normalizeMessage(message);
    return { ...normalized, text: plaintextEcho || normalized.text };
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

  // Load one case by its id. The narrative is UNLOCKED in the browser (staff key path) before
  // it is normalised, so the case page shows the readable text. Cases with no encrypted content
  // (dev plaintext) are returned unchanged.
  async getReport(id) {
    const report = await staffApi.get(`/api/v1/internal/cases/${encodeURIComponent(id)}`);
    const decrypted = await cryptoService.decryptReportForStaff(id, report);
    return normalizeReport(decrypted);
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
      // A reason is required by the backend only when reopening a CLOSED case; we pass it
      // through when present so the reopen is justified and audited.
      const reasonParam = patch.statusChangeReason
        ? `&reason=${encodeURIComponent(patch.statusChangeReason)}`
        : "";
      updated = await staffApi.patch(`${base}/status?status=${value}${reasonParam}`);
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
