// Audit trail — read-only from the UI.
//
// This now talks to the REAL PrivacyPilot backend (AuditController) at
// /api/privacypilot/audit. The trail is write-once evidence: the browser can only
// READ it. Entries are written server-side (by AuditService) whenever a real change
// happens, so no page can bypass logging.
//
// The backend returns each entry already shaped the way this screen expects
// (id, at, actorName, actorRole, action, entityType, entityId, entityLabel,
// oldValue, newValue), so the AuditTrailPage needs no changes.
import { get } from './client';

const BASE = '/api/privacypilot/audit';

export const auditService = {
  /**
   * List audit entries for the caller's tenant, newest first.
   * @param {object} [filters] optional { entityType, entityId, action, q, from, to, limit }.
   *   Any field may be omitted; omitted fields are simply not sent.
   */
  list: (filters = {}) => {
    // Build the query string from only the filters that were actually provided,
    // so an empty filter object just fetches the whole (capped) trail.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    }
    const qs = params.toString();
    return get(qs ? `${BASE}?${qs}` : BASE);
  },

  /** One audit entry by id (404 if it is not this tenant's). */
  get: (id) => get(`${BASE}/${id}`),
};
