/**
 * Settings & compliance service.
 *
 *   • get()               — staff-only retention/review settings → `staffApi`.
 *   • submitDataRequest() — a GDPR data-subject request from the PUBLIC privacy page,
 *                           so it goes through `publicApi` (no login required).
 *
 * NOTE: the SafeVoice backend does not expose these endpoints yet, so these areas will
 * surface an error until they are built. That is intentional — there is no mock data
 * any more, so unfinished areas fail loudly instead of pretending to work.
 */
import { publicApi, staffApi } from "./api";

export const settingsService = {
  get() {
    return staffApi.get("/api/safevoice/settings");
  },
  submitDataRequest(payload) {
    return publicApi.post("/api/safevoice/data-requests", payload);
  },
};

export default settingsService;
