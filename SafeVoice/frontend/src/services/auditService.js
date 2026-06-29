/**
 * Audit service — read-only access to the immutable activity log (staff only).
 * Goes through `staffApi` so the signed-in actor's identity headers are sent, and
 * formats each entry's timestamp into the short, readable form the table shows.
 */
import { staffApi } from "./api";
import { formatTimestamp } from "./caseNormalizer";

export const auditService = {
  async list(limit = 200) {
    const logs = await staffApi.get(`/api/v1/internal/audit?limit=${limit}`);
    // Make the ISO timestamps friendly ("2026-06-29 14:08"); leave everything else as-is.
    return Array.isArray(logs)
      ? logs.map((log) => ({ ...log, timestamp: formatTimestamp(log.timestamp) }))
      : [];
  },
};

export default auditService;
