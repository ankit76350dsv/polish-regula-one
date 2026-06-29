/**
 * Audit service — read-only access to the immutable activity log (staff only).
 *
 * Goes through `staffApi` so the signed-in actor's identity headers are sent.
 *
 * NOTE: the SafeVoice backend does not expose this endpoint yet, so the "Audit trail"
 * page will surface a load error until it is built. That is intentional — there is no
 * mock data any more, so unfinished areas fail loudly instead of showing fake logs.
 */
import { staffApi } from "./api";

export const auditService = {
  list() {
    return staffApi.get("/api/safevoice/audit");
  },
};

export default auditService;
