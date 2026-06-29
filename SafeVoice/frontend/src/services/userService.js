/**
 * User & permission service — authorised staff and the role permission matrix.
 *
 * These are staff-only endpoints, so they go through `staffApi` (which carries the
 * signed-in actor's identity headers).
 *
 * NOTE: the SafeVoice backend does not expose these endpoints yet, so the "Access
 * controls" page will surface a load error until they are built. That is intentional —
 * the app no longer uses any mock data, so unfinished areas fail loudly rather than
 * showing fake records.
 */
import { staffApi } from "./api";

export const userService = {
  list() {
    return staffApi.get("/api/safevoice/users");
  },
  invite(payload) {
    return staffApi.post("/api/safevoice/users/invite", payload);
  },
  remove(id) {
    return staffApi.del(`/api/safevoice/users/${encodeURIComponent(id)}`);
  },
};

export default userService;
