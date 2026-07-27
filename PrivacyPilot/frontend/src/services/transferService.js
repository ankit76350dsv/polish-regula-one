// Chapter V transfer register — destination, mechanism, TIA documentation.
//
// This now talks to the REAL PrivacyPilot backend (TransferController):
// GET/POST/PUT/DELETE on /api/privacypilot/transfers. It replaced the in-browser mock.
//
// The server owns the tenant, the timestamps, the created/updated-by stamps and the
// audit trail, and it protects the links: an optional vendorId/activityId must belong
// to this tenant, and a transfer cannot be archived while an activity still lists it.
import { get, post, put, del } from './client';

const BASE = '/api/privacypilot/transfers';

/**
 * Map a transfer object to the exact TransferRequest the backend expects — only the
 * editable fields (never id/tenantId/timestamps). Empty link/enum values become null.
 */
function toRequest(t) {
  return {
    vendorId: t.vendorId || null,
    activityId: t.activityId || null,
    destinationCountry: t.destinationCountry ?? '',
    recipient: t.recipient ?? '',
    mechanism: t.mechanism || null,
    adequacyNote: t.adequacyNote ?? '',
    tiaDocumented: !!t.tiaDocumented,
    tiaRef: t.tiaRef ?? '',
  };
}

export const transferService = {
  /** All live transfers for the caller's tenant, newest change first. */
  list: () => get(BASE),

  /** One transfer by id (404 if it is not this tenant's). */
  get: (id) => get(`${BASE}/${id}`),

  /** Create a transfer. */
  create: (data) => post(BASE, toRequest(data)),

  /**
   * Update a transfer. The backend PUT replaces the whole record, so the caller passes
   * the FULL current transfer (the slice merges the small UI patch onto it).
   */
  update: (id, data) => put(`${BASE}/${id}`, toRequest(data)),

  /**
   * Archive (soft-delete) a transfer. The backend refuses (409) if an activity still
   * lists it. Returns the id so the slice can drop it from the list.
   */
  archive: async (id) => {
    await del(`${BASE}/${id}`);
    return id;
  },
};
