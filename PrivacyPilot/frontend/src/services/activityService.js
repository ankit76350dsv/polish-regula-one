// ROPA activities — Art. 30 register records.
//
// This service now talks to the REAL PrivacyPilot backend
// (ProcessingActivityController.java): GET/POST/PUT/DELETE on
// /api/privacypilot/activities. It replaced the in-browser mock entirely.
//
// What the SERVER owns now (so the client can never spoof it):
//   - the tenant (from the verified session), the owner name, the status,
//   - the DPIA verdict (recomputed from the screening criteria),
//   - the audit trail (an immutable entry per create/update/approve/archive),
//   - RBAC (the caller's role must permit the action, else 403 FORBIDDEN).
// The browser only sends the fields a user actually fills in.
import { get, post, put, del } from './client';

const BASE = '/api/privacypilot/activities';

/**
 * Turn the wizard's form object into the exact ActivityRequest the backend expects.
 *
 * WHY this mapping exists:
 *  1) The form carries extra, server-owned fields (id, status, dpiaVerdict, owner,
 *     timestamps…) that must NOT be sent — we send only the editable fields.
 *  2) Enum fields use lowercase string CODES on both sides (e.g. "controller",
 *     "consent"), but an EMPTY string is not a valid code — the backend would reject
 *     it. So we convert every empty enum value to null (meaning "not chosen").
 */
function toRequest(form) {
  // Empty string → null for the fields that are enums on the backend.
  const enumOrNull = (v) => (v ? v : null);
  return {
    // Step 1 — basics
    name: form.name,
    department: enumOrNull(form.department),
    role: form.role, // required by the backend; the wizard always sets a valid value
    controllersServed: form.controllersServed ?? '',
    // Step 2 — purpose & lawful basis
    purpose: form.purpose ?? '',
    lawfulBasis: enumOrNull(form.lawfulBasis),
    legitimateInterestDetail: form.legitimateInterestDetail ?? '',
    provisionStatement: form.provisionStatement ?? '',
    // Step 3 — data & subjects
    dataSubjects: form.dataSubjects ?? [],
    dataCategories: form.dataCategories ?? [],
    art9Condition: enumOrNull(form.art9Condition),
    // Criminal-offence data (Art. 10) is derived from the ticked categories, not a
    // separate checkbox — compute it here so the flag is always correct.
    art10: (form.dataCategories ?? []).includes('criminal') || !!form.art10,
    dataSources: form.dataSources ?? [],
    // Step 4 — recipients & processors
    recipients: form.recipients ?? [],
    vendorIds: form.vendorIds ?? [],
    // Step 5 — third-country transfers
    transfer: !!form.transfer,
    transferIds: form.transferIds ?? [],
    // Step 6 — retention
    retentionPeriod: form.retentionPeriod ?? '',
    retentionBasis: form.retentionBasis ?? '',
    // Step 7 — security measures
    toms: form.toms ?? [],
    // Step 8 — DPIA screening (the backend turns these into the verdict)
    dpiaCriteria: form.dpiaCriteria ?? [],
  };
}

export const activityService = {
  /** All live (non-archived) activities for the caller's tenant, newest first. */
  list: () => get(BASE),

  /** One activity by id (404 if it is not this tenant's). */
  get: (id) => get(`${BASE}/${id}`),

  /** Create a new activity (server sets tenant/owner/status and starts it as DRAFT). */
  create: (data) => post(BASE, toRequest(data)),

  /** Replace the editable fields of an existing activity. */
  update: (id, patch) => put(`${BASE}/${id}`, toRequest(patch)),

  /**
   * Archive (soft-delete) an activity — kept on disk for the 10-year retention rule
   * but hidden from the register. The backend returns no body, so we resolve to the
   * id and let the slice drop it from the list.
   */
  archive: async (id) => {
    await del(`${BASE}/${id}`);
    return id;
  },

  /** Approve (sign off) an activity → status becomes "approved". Returns the record. */
  approve: (id) => post(`${BASE}/${id}/approve`),
};
