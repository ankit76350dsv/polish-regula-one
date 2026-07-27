// Processors / sub-processors (Art. 28 GDPR vendors and their DPAs).
//
// This now talks to the REAL PrivacyPilot backend (VendorController):
// GET/POST/PUT/DELETE on /api/privacypilot/vendors. It replaced the in-browser mock.
//
// The server owns the tenant, the timestamps, the created/updated-by stamps and the
// audit trail, and it protects the links: a processor cannot be archived while an
// activity or transfer still references it (409).
import { get, post, put, del } from './client';

const BASE = '/api/privacypilot/vendors';

/**
 * Map a vendor object to the exact VendorRequest the backend expects — only the
 * editable fields (never id/tenantId/timestamps). Empty enum values become null so
 * the server applies its defaults (dpaStatus → missing, riskLevel → medium).
 */
function toRequest(v) {
  return {
    name: v.name,
    country: v.country ?? '',
    region: v.region ?? '',
    dpaStatus: v.dpaStatus || null,
    subprocessors: v.subprocessors ?? [],
    riskLevel: v.riskLevel || null,
    lastReviewAt: v.lastReviewAt ?? null,
  };
}

export const vendorService = {
  /** All live processors for the caller's tenant, newest change first. */
  list: () => get(BASE),

  /** One processor by id (404 if it is not this tenant's). */
  get: (id) => get(`${BASE}/${id}`),

  /** Create a processor. */
  create: (data) => post(BASE, toRequest(data)),

  /**
   * Update a processor. The backend PUT replaces the whole record, so the caller
   * passes the FULL current vendor (the slice merges the small UI patch onto it).
   */
  update: (id, data) => put(`${BASE}/${id}`, toRequest(data)),

  /**
   * Archive (soft-delete) a processor. The backend refuses (409) if an activity or
   * transfer still links to it. Returns the id so the slice can drop it from the list.
   */
  archive: async (id) => {
    await del(`${BASE}/${id}`);
    return id;
  },
};
