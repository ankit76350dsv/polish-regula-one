/**
 * Organisation service — the signed-in user's own tenant details.
 *
 * Identity/organisation live in RegulaOne, so we read them from there (GET /api/tenant/info)
 * through the `api` client (RegulaOne base + shared SSO cookie). The backend returns the
 * caller's OWN organisation only — the tenant is derived from the session, never passed in.
 */
import { api } from "./api";

export const orgService = {
  // { id, name, nip, regon, email, phone, address, city, postalCode, status, createdAt, updatedAt }
  getMyOrg() {
    return api.get("/api/tenant/info");
  },
};

export default orgService;
