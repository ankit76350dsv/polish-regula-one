/**
 * User & permission service — authorised staff and the role permission matrix.
 * Delegates to the mock backend now; swap to the real API by flipping USE_MOCK_DATA.
 */
import { USE_MOCK_DATA } from "../config";
import mockApi from "../mock/mockApi";
import { api } from "./api";

export const userService = {
  list() {
    if (USE_MOCK_DATA) return mockApi.listUsers();
    return api.get("/api/safevoice/users");
  },
  invite(payload) {
    if (USE_MOCK_DATA) return mockApi.inviteUser(payload);
    return api.post("/api/safevoice/users/invite", payload);
  },
  remove(id) {
    if (USE_MOCK_DATA) return mockApi.removeUser(id);
    return api.del(`/api/safevoice/users/${encodeURIComponent(id)}`);
  },
};

export default userService;
