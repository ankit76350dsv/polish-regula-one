/**
 * Audit service — read-only access to the immutable activity log (staff only).
 * Goes through `staffApi` so the signed-in actor's identity headers are sent, and
 * formats each entry's timestamp into the short, readable form the table shows.
 */
import { staffApi } from "./api";
import { formatTimestamp } from "./caseNormalizer";

export const auditService = {
  // One page of the audit trail with optional filters. Returns the rows (with friendly
  // timestamps) plus the paging info the table needs.
  async list({
    page = 1,
    size = 20,
    search = "",
    actionType = "",
    outcome = "",
    subjectId = "",
    from = "",
    to = "",
  } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(size));
    if (search && search.trim()) params.set("search", search.trim());
    if (actionType) params.set("actionType", actionType);
    if (outcome) params.set("outcome", outcome);
    if (subjectId && subjectId.trim()) params.set("subjectId", subjectId.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const data = await staffApi.get(`/api/v1/internal/audit?${params.toString()}`);
    return {
      // Make the ISO timestamps friendly ("2026-06-29 14:08"); leave everything else as-is.
      items: Array.isArray(data?.items)
        ? data.items.map((log) => ({ ...log, timestamp: formatTimestamp(log.timestamp) }))
        : [],
      page: data?.page ?? page,
      size: data?.size ?? size,
      total: data?.total ?? 0,
      totalPages: data?.totalPages ?? 0,
    };
  },
};

export default auditService;
