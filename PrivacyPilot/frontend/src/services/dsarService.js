// Data subject requests (Arts. 15–22).
//
// This service talks to the real PrivacyPilot backend (DsarController):
// GET/POST/PUT on /api/privacypilot/dsars plus the dedicated extend, complete,
// and refuse actions. The server owns the tenant, lifecycle, legal deadline,
// timestamps, authorization, and immutable audit trail.
import { get, post, put } from './client';

const BASE = '/api/privacypilot/dsars';

/** Days remaining until the deadline; negative = overdue. */
export function dsarDaysLeft(dsar) {
  return Math.ceil((new Date(dsar.dueAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Map a DSAR object to the exact DsarRequest accepted by the backend. Lifecycle,
 * deadline, tenant, audit, and timestamp fields are deliberately excluded because
 * the server owns them.
 */
function toRequest(dsar) {
  return {
    type: dsar.type,
    requesterName: dsar.requesterName,
    requesterEmail: dsar.requesterEmail ?? '',
    relation: dsar.relation ?? '',
    // Used on create; ignored by the backend on update so the legal clock cannot
    // be moved through an ordinary edit.
    receivedAt: dsar.receivedAt ?? null,
    notes: dsar.notes ?? '',
    identityVerified: !!dsar.identityVerified,
    identityMethod: dsar.identityMethod ?? '',
    tasks: (dsar.tasks ?? []).map((task) => ({
      id: task.id,
      text: task.text,
      done: !!task.done,
    })),
  };
}

export const dsarService = {
  /** All requests for the caller's tenant, most recently recorded first. */
  list: () => get(BASE),

  /** One request by id (404 if it is not in the caller's tenant). */
  get: (id) => get(`${BASE}/${id}`),

  /** Record a request; the server sets its initial state and one-month deadline. */
  create: (data) => post(BASE, toRequest(data)),

  /** Replace the request's editable content; server-owned lifecycle fields stay intact. */
  update: (id, data) => put(`${BASE}/${id}`, toRequest(data)),

  /** Art. 12(3): extend the original one-month deadline by two further months. */
  extend: (id, reason) => post(`${BASE}/${id}/extend`, { reason }),

  /** Mark an in-progress request completed; the server stamps completedAt. */
  complete: (id) => post(`${BASE}/${id}/complete`),

  /** Refuse an in-progress request with the mandatory documented legal reason. */
  refuse: (id, reason) => post(`${BASE}/${id}/refuse`, { reason }),
};
