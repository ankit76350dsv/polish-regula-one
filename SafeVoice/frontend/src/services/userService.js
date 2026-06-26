/**
 * User & permission service — authorised staff and the role permission matrix.
 * Delegates to the mock backend now; swap to the real API by flipping USE_MOCK.
 */
import { USE_MOCK } from "../config";
import mockApi from "../mock/mockApi";
import { api } from "./api";

export const userService = {
  list() {
    if (USE_MOCK) return mockApi.listUsers();
    return api.get("/api/safevoice/users");
  },
  invite(payload) {
    if (USE_MOCK) return mockApi.inviteUser(payload);
    return api.post("/api/safevoice/users/invite", payload);
  },
  remove(id) {
    if (USE_MOCK) return mockApi.removeUser(id);
    return api.del(`/api/safevoice/users/${encodeURIComponent(id)}`);
  },
};

export default userService;
